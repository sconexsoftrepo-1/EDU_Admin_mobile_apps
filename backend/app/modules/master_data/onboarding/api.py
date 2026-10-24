"""Master data entry: students and parents, admission forms, teaching and non-teaching staff
onboarding (with salary/pay structure), courses with year-based batches, and course enrollment.

Each request writes several tables in one transaction through the tables' own services, so
records get the same validation, reference checks, SQL statements (each table module's
INSERT_SQL) and audit entries as the individual screens. GET /master-data/actions describes the
same operations as dashboard forms; their flat "section.field" values map onto these payloads.
"""

import importlib
import re
import json
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import ValidationError

from app.core.resources import CATALOG, staff_only
from app.core.security import current_user, has_permission
from app.core.storage import audit

from .schemas import (
    ActionInput,
    AdmissionFormInput,
    BatchInput,
    CourseEnrollmentInput,
    CourseInput,
    NonTeachingStaffInput,
    ParentEnrollmentInput,
    ParentLink,
    StudentEnrollmentInput,
    TeachingStaffInput,
)

router = APIRouter(prefix="/master-data", tags=["Master data entry"])

_MODULES = {
    e["screen"]: e["module"]
    for e in json.loads((Path(__file__).parents[3] / "contracts/resources.json").read_text())
    if e["generic_api"]
}


def table_service(table):
    return importlib.import_module(f"app.modules.{_MODULES[table]}.{table}.api").service


def clean(values):
    return {k: v for k, v in (values or {}).items() if v is not None and v != ""}


def json_value(name, value):
    """Text typed into a form for a JSON column becomes a JSON object."""
    if isinstance(value, str):
        return {"line1": value} if "address" in name else {"text": value}
    return value


def create(data, table, values, actor):
    json_fields = {f["name"] for f in CATALOG[table]["fields"] if f["type"] in {"jsonb", "json"}}
    values = {k: json_value(k, v) if k in json_fields else v for k, v in clean(values).items()}
    return table_service(table).create(data, values, actor)


def records(data, table):
    return table_service(table).repo.list(data)


def need(data, user, *grants):
    missing = [f"{t}:{a}" for t, a in grants if not has_permission(data, user, t, a)]
    if missing:
        raise HTTPException(403, "Permission required: " + ", ".join(missing))


# ---------------------------------------------------------------------------
# Operations
# ---------------------------------------------------------------------------


def link_parent(data, student_code, link: ParentLink, actor):
    if link.parent_code:
        parent = table_service("parents").repo.get(data, link.parent_code)
    elif link.parent:
        parent = create(data, "parents", link.parent, actor)
    else:
        raise HTTPException(422, "Give parent_code or parent details")
    relation = create(
        data,
        "student_parents",
        {
            "student_code": student_code,
            "parent_code": parent["code"],
            "relationship": link.relationship,
            "is_primary": link.is_primary,
            "can_pickup": link.can_pickup,
            "receives_notifications": link.receives_notifications,
        },
        actor,
    )
    return {"parent": parent, "relationship": relation}


def enroll_student(data, body: StudentEnrollmentInput, actor):
    student = create(data, "students", body.student, actor)
    links = [link_parent(data, student["code"], p, actor) for p in body.parents]
    return {"student": student, "parents": links}


def enroll_parents(data, student_code, body: ParentEnrollmentInput, actor):
    table_service("students").repo.get(data, student_code)
    return {"student_code": student_code, "parents": [link_parent(data, student_code, p, actor) for p in body.parents]}


def admission_form(data, body: AdmissionFormInput, actor):
    application = create(
        data,
        "admission_applications",
        {"status": "submitted", "applied_on": date.today().isoformat(), "admission_category": "regular", **clean(body.application)},
        actor,
    )
    guardians = [
        create(data, "application_guardians", {"is_primary": i == 0, **clean(g), "application_code": application["code"]}, actor)
        for i, g in enumerate(body.guardians)
    ]
    qualifications = [
        create(data, "application_qualifications", {**clean(q), "application_code": application["code"]}, actor)
        for q in body.qualifications
    ]
    return {"application": application, "guardians": guardians, "qualifications": qualifications}


def onboard_teaching(data, body: TeachingStaffInput, actor):
    employee = create(data, "employees", {**clean(body.employee), "employee_type": "teacher"}, actor)
    teacher = create(data, "teachers", {**clean(body.teacher), "employee_code": employee["code"]}, actor)
    return {"employee": employee, "teacher": teacher}


def onboard_non_teaching(data, body: NonTeachingStaffInput, actor):
    employee = create(data, "employees", {**clean(body.employee), "employee_type": "staff"}, actor)
    profile = create(data, "staff_profiles", {**clean(body.staff_profile), "employee_code": employee["code"]}, actor)
    components = [
        create(
            data,
            "employee_salary_components",
            {
                **c.model_dump(mode="json", exclude_none=True),
                "employee_code": employee["code"],
                "effective_from": (c.effective_from or date.fromisoformat(str(employee["join_date"])[:10])).isoformat(),
            },
            actor,
        )
        for c in body.salary_components
    ]
    return {"employee": employee, "staff_profile": profile, "salary_components": components}


def department_for(data, typed, campus_code, actor):
    """The department typed on the course form: an existing one (by code or name), otherwise a new
    department registered on the campus (the only campus when none is chosen)."""
    typed = (typed or "").strip()
    if not typed:
        raise HTTPException(422, "Enter the department (e.g. Science, Commerce, Humanities)")
    departments = data["records"].get("departments", {})
    found = next((d for d in departments.values()
                  if d["code"].casefold() == typed.casefold() or str(d.get("name", "")).casefold() == typed.casefold()), None)
    if found:
        return found["code"]
    campuses = list(data["records"].get("campuses", {}).values())
    if not campus_code:
        if len(campuses) != 1:
            raise HTTPException(422, "Choose the campus of the new department" if campuses
                                else "Create the campus first (Settings) before adding departments")
        campus_code = campuses[0]["code"]
    code = "DEP-" + (re.sub(r"[^A-Z0-9]+", "-", typed.upper()).strip("-")[:40] or "GENERAL")
    if code in departments:
        code = f"{code}-{len(departments) + 1}"
    return create(data, "departments", {"code": code, "name": typed, "campus_code": campus_code}, actor)["code"]


def create_course(data, body: CourseInput, actor, campus_code=None):
    program = dict(body.program)
    program["department_code"] = department_for(data, program.get("department_code"), campus_code, actor)
    program = create(data, "programs", program, actor)
    batches = [create(data, "batches", {**batch_record(b), "program_code": program["code"]}, actor) for b in body.batches]
    return {"program": program, "batches": batches}


def batch_record(values):
    """A year-based batch needs its start and end year; the name is derived ("2026-28")."""
    b = clean(values)
    try:
        start, end = int(b.get("entry_year")), int(b.get("graduation_year"))
    except (TypeError, ValueError):
        raise HTTPException(422, "Enter the batch start year and end year") from None
    if not 1990 <= start < end <= start + 10:
        raise HTTPException(422, "The batch end year must be after the start year (at most 10 years)")
    return {**b, "entry_year": start, "graduation_year": end, "name": b.get("name") or f"{start}-{end % 100:02d}"}


BATCH_FIELDS = lambda required: [  # noqa: E731 - used by two forms
    field("batch.entry_year", "Batch: start year", "number", required),
    field("batch.graduation_year", "Batch: end year", "number", required),
]


def create_batch(data, program_code, body: BatchInput, actor):
    table_service("programs").repo.get(data, program_code)
    batch = create(data, "batches", {**batch_record(body.batch), "program_code": program_code}, actor)
    section_values = [clean(s) for s in body.sections]
    if any(not s.get("semester_code") for s in section_values):
        # The simplified batch form binds new sections to the first semester of its entry year.
        entry_year = str(batch["entry_year"])
        academic_years = {y["code"] for y in records(data, "academic_years")
                          if str(y.get("start_date", ""))[:4] == entry_year}
        candidates = [s for s in records(data, "semesters")
                      if s.get("academic_year_code") in academic_years and int(s.get("semester_number") or 0) == 1]
        if len(candidates) == 1:
            section_values = [{**s, "semester_code": s.get("semester_code") or candidates[0]["code"]}
                              for s in section_values]
        # Sections can be registered before academic calendars are configured.
        # Never guess a link when no matching semester exists or the match is ambiguous.
    sections = [create(data, "sections", {**s, "batch_code": batch["code"]}, actor) for s in section_values]
    return {"batch": batch, "sections": sections}


def enroll_in_course(data, body: CourseEnrollmentInput, actor):
    table_service("sections").repo.get(data, body.section_code)
    enrolled_on = (body.enrolled_on or date.today()).isoformat()
    enrollments = [
        create(
            data,
            "student_enrollments",
            {"student_code": line.student_code, "section_code": body.section_code,
             "roll_number": line.roll_number, "enrolled_on": enrolled_on, "status": "active"},
            actor,
        )
        for line in body.students
    ]
    return {"section_code": body.section_code, "enrollments": enrollments}


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


@router.post("/students", status_code=201)
def post_student(body: StudentEnrollmentInput, request: Request, user=Depends(current_user)):
    """Student enrollment, optionally with parents and their relationships."""
    staff_only(user)
    with request.app.state.store.transaction() as data:
        need(data, user, ("students", "create"), *([("parents", "create"), ("student_parents", "create")] if body.parents else []))
        return enroll_student(data, body, user["code"])


@router.post("/students/{student_code}/parents", status_code=201)
def post_parents(student_code: str, body: ParentEnrollmentInput, request: Request, user=Depends(current_user)):
    """Student-based parent enrollment: create or link parents to one student."""
    staff_only(user)
    with request.app.state.store.transaction() as data:
        need(data, user, ("parents", "create"), ("student_parents", "create"))
        return enroll_parents(data, student_code, body, user["code"])


@router.get("/students/{student_code}/parents")
def get_parents(student_code: str, request: Request, user=Depends(current_user)):
    staff_only(user)
    data = request.app.state.store.snapshot()
    need(data, user, ("student_parents", "view"))
    links = [r for r in records(data, "student_parents") if r["student_code"] == student_code]
    parents = {p["code"]: p for p in records(data, "parents")}
    return {"student_code": student_code, "items": [{"relationship": r, "parent": parents.get(r["parent_code"])} for r in links]}


@router.post("/admission-forms", status_code=201)
def post_admission_form(body: AdmissionFormInput, request: Request, user=Depends(current_user)):
    """Admission form: application with guardians and qualifying education. Upload the
    certificates with POST /api/v1/documents/upload (kind admission_document)."""
    staff_only(user)
    with request.app.state.store.transaction() as data:
        need(data, user, ("admission_applications", "create"),
             *([("application_guardians", "create")] if body.guardians else []),
             *([("application_qualifications", "create")] if body.qualifications else []))
        return admission_form(data, body, user["code"])


@router.post("/staff/teaching", status_code=201)
def post_teaching_staff(body: TeachingStaffInput, request: Request, user=Depends(current_user)):
    """Teaching staff onboarding: employee and teacher profile in one integrated form."""
    staff_only(user)
    with request.app.state.store.transaction() as data:
        need(data, user, ("employees", "create"), ("teachers", "create"))
        return onboard_teaching(data, body, user["code"])


@router.post("/staff/non-teaching", status_code=201)
def post_non_teaching_staff(body: NonTeachingStaffInput, request: Request, user=Depends(current_user)):
    """Non-teaching staff onboarding: employee, staff profile and salary/pay structure."""
    staff_only(user)
    with request.app.state.store.transaction() as data:
        need(data, user, ("employees", "create"), ("staff_profiles", "create"),
             *([("employee_salary_components", "create")] if body.salary_components else []))
        return onboard_non_teaching(data, body, user["code"])


@router.get("/staff")
def get_staff(request: Request, kind: str = Query("teaching", pattern="^(teaching|non-teaching)$"), user=Depends(current_user)):
    """Teaching staff with their teacher profile, or non-teaching staff with profile and pay structure."""
    staff_only(user)
    data = request.app.state.store.snapshot()
    need(data, user, ("employees", "view"))
    employee_type = "teacher" if kind == "teaching" else "staff"
    employees = [e for e in records(data, "employees") if e.get("employee_type") == employee_type]
    if kind == "teaching":
        profiles = {t["employee_code"]: t for t in records(data, "teachers")}
        return {"items": [{"employee": e, "teacher": profiles.get(e["code"])} for e in employees]}
    profiles = {s["employee_code"]: s for s in records(data, "staff_profiles")}
    pay = {}
    for c in records(data, "employee_salary_components"):
        pay.setdefault(c["employee_code"], []).append(c)
    return {"items": [{"employee": e, "staff_profile": profiles.get(e["code"]), "salary_components": pay.get(e["code"], [])} for e in employees]}


@router.post("/courses", status_code=201)
def post_course(body: CourseInput, request: Request, user=Depends(current_user)):
    """Course creation with its year-based batches."""
    staff_only(user)
    with request.app.state.store.transaction() as data:
        need(data, user, ("programs", "create"), *([("batches", "create")] if body.batches else []))
        return create_course(data, body, user["code"])


@router.post("/courses/{program_code}/batches", status_code=201)
def post_batch(program_code: str, body: BatchInput, request: Request, user=Depends(current_user)):
    """Year-based batch for a course, with its sections."""
    staff_only(user)
    with request.app.state.store.transaction() as data:
        need(data, user, ("batches", "create"), *([("sections", "create")] if body.sections else []))
        return create_batch(data, program_code, body, user["code"])


@router.get("/courses/{program_code}")
def get_course(program_code: str, request: Request, user=Depends(current_user)):
    """Course with its batches, sections and enrolled-student counts."""
    staff_only(user)
    data = request.app.state.store.snapshot()
    need(data, user, ("programs", "view"))
    program = table_service("programs").repo.get(data, program_code)
    batches = [b for b in records(data, "batches") if b["program_code"] == program_code]
    codes = {b["code"] for b in batches}
    sections = [s for s in records(data, "sections") if s["batch_code"] in codes]
    counts = {}
    for e in records(data, "student_enrollments"):
        counts[e["section_code"]] = counts.get(e["section_code"], 0) + 1
    return {"program": program, "batches": [
        {**b, "sections": [{**s, "enrolled": counts.get(s["code"], 0)} for s in sections if s["batch_code"] == b["code"]]}
        for b in batches
    ]}


@router.post("/course-enrollments", status_code=201)
def post_course_enrollment(body: CourseEnrollmentInput, request: Request, user=Depends(current_user)):
    """Enroll students into a course batch section."""
    staff_only(user)
    with request.app.state.store.transaction() as data:
        need(data, user, ("student_enrollments", "create"))
        return enroll_in_course(data, body, user["code"])


# ---------------------------------------------------------------------------
# Dashboard forms (flat "section.field" values)
# ---------------------------------------------------------------------------

INPUT_TYPES = {"date": "date", "timestamp with time zone": "datetime-local", "boolean": "boolean",
               "integer": "number", "numeric": "number", "smallint": "number", "bigint": "number"}


def fields(table, prefix, skip=(), optional=False, label=None):
    out = []
    label = label or prefix.replace('_', ' ').title()
    for f in CATALOG[table]["fields"]:
        if f["name"] in {"code", *skip} or f["type"] == "text[]":
            continue
        kind = "textarea" if f["type"] == "jsonb" else "select" if f.get("choices") else INPUT_TYPES.get(f["type"], "text")
        out.append({"key": f"{prefix}.{f['name']}", "label": f"{label}: {f['name'].replace('_', ' ')}",
                    "type": kind, "required": bool(f.get("required")) and not optional, "options": f.get("choices") or [],
                    "reference": f.get("reference")})
    return out


def field(key, label, kind="text", required=True, options=None, reference=None):
    return {"key": key, "label": label, "type": kind, "required": required, "options": options or [],
            "reference": reference}


LINK_FIELDS = [
    field("link.relationship", "Relationship", "select", False, ["father", "mother", "guardian", "other"]),
    field("link.is_primary", "Primary contact", "boolean", False),
    field("link.can_pickup", "Can pick up the student", "boolean", False),
]
PAY = [("basic_pay", "Basic pay", "earning"), ("hra", "House rent allowance", "earning"),
       ("da", "Dearness allowance", "earning"), ("special_allowance", "Special allowance", "earning"),
       ("conveyance", "Conveyance allowance", "earning"), ("provident_fund", "Provident fund", "deduction"),
       ("professional_tax", "Professional tax", "deduction"), ("income_tax", "Income tax (TDS)", "deduction")]


def nest(values):
    out = {}
    for key, value in values.items():
        section, _, name = key.partition(".")
        if name and value not in (None, ""):
            out.setdefault(section, {})[name] = value
        elif not name:
            out[key] = value
    return out


GUARDIAN_FIELDS = [
    field("guardian.relationship", "Guardian: relationship with the student", "select", False,
          ["father", "mother", "guardian", "other"]),
    field("guardian.first_name", "Guardian: first name", required=False),
    field("guardian.last_name", "Guardian: last name", required=False),
    field("guardian.phone", "Guardian: mobile number (primary contact)", "tel", False),
    field("guardian.alternate_phone", "Guardian: secondary number", "tel", False),
]


def guardian_link(v):
    """The single guardian of the student enrollment form; the guardian is the primary contact."""
    g = v.get("guardian", {})
    if not g.get("first_name"):
        return []
    details = {k: g[k] for k in ("first_name", "last_name", "phone", "alternate_phone") if g.get(k)}
    return [ParentLink(parent=details, relationship=g.get("relationship") or "guardian", is_primary=True,
                       can_pickup=True)]


def parent_link(v):
    if not v.get("parent", {}).get("first_name"):
        return []
    link = v.get("link", {})
    return [ParentLink(parent=v["parent"], relationship=link.get("relationship", "guardian"),
                       is_primary=bool(link.get("is_primary")), can_pickup=bool(link.get("can_pickup")))]


# Standard fee heads of a course fee structure: form key, head code, name, category.
FEE_HEADS = [
    ("tuition", "FH-TUITION", "Tuition fee", "academic"),
    ("admission", "FH-ADMISSION", "Admission fee", "academic"),
    ("exam", "FH-EXAM", "Examination fee", "academic"),
    ("lab", "FH-LAB", "Laboratory fee", "academic"),
    ("library", "FH-LIBRARY", "Library fee", "academic"),
    ("other", "FH-OTHER", "Other charges", "other"),
    ("hostel", "FH-HOSTEL", "Hostel fee", "hostel"),
    ("transport", "FH-TRANSPORT", "Bus / transport fee", "transport"),
]


def course_fee_structure(data, v, actor):
    """Annual fee structure of a course for one academic year and year of study (semester_number
    holds the year of study). Hostel and bus fees are charged only to students who choose them."""
    program_code, year_code = v.get("program_code"), v.get("academic_year_code")
    table_service("programs").repo.get(data, program_code)
    table_service("academic_years").repo.get(data, year_code)
    year_of_study = int(v.get("year_of_study") or 1)
    due_date = v.get("due_date")
    if not due_date:
        raise HTTPException(422, "Give the fee due date")
    heads = data["records"].setdefault("fee_heads", {})
    structures = data["records"].setdefault("fee_structures", {})
    charged = {c["fee_structure_code"] for c in data["records"].get("student_fee_charges", {}).values()}
    saved = []
    for key, code, name, category in FEE_HEADS:
        amount = v.get("amount", {}).get(key)
        if amount in (None, ""):
            continue
        if code not in heads:
            create(data, "fee_heads", {"code": code, "name": name, "category": category,
                                       "collection_ownership": "internal",
                                       "scholarship_eligible": category == "academic"}, actor)
        existing = next((s for s in structures.values() if s["program_code"] == program_code
                         and s["academic_year_code"] == year_code and s["fee_head_code"] == code
                         and int(s["semester_number"]) == year_of_study and int(s.get("installment_number") or 1) == 1), None)
        if existing:
            if existing["code"] in charged and str(existing["amount"]) != str(amount):
                raise HTTPException(409, f"{name} is already charged to students; it cannot be changed for this year")
            existing.update(amount=str(amount), due_date=due_date, currency=v.get("currency") or "INR")
            audit(data, actor, "edit", "fee_structures", existing["code"])
            saved.append(existing)
        else:
            saved.append(create(data, "fee_structures", {
                "program_code": program_code, "academic_year_code": year_code, "fee_head_code": code,
                "semester_number": year_of_study, "installment_number": 1, "billing_frequency": "annual",
                "amount": str(amount), "due_date": due_date, "currency": v.get("currency") or "INR"}, actor))
    if not saved:
        raise HTTPException(422, "Enter at least one fee amount")
    return {"program_code": program_code, "academic_year_code": year_code, "year_of_study": year_of_study,
            "fee_structures": saved}


def promote_batch(data, v, actor):
    from ..enrollment.api import promote_students

    return promote_students(data, v.get("batch_code", ""), int(v.get("to_year") or 0), actor)


ACTIONS = {
    # Student enrollment is also the admission form of the dashboard: the student with one guardian
    # (name, relationship, mobile number as the primary contact). More guardians: "Add parent or guardian".
    "enroll-student": (
        "Enroll student", "students", [("students", "create"), ("parents", "create"), ("student_parents", "create")],
        lambda: fields("students", "student") + GUARDIAN_FIELDS,
        lambda d, v, a: enroll_student(d, StudentEnrollmentInput(student=v.get("student", {}), parents=guardian_link(v)), a),
    ),
    "enroll-parent": (
        "Add parent or guardian", "student_parents", [("parents", "create"), ("student_parents", "create")],
        lambda: [field("student_code", "Student", reference="students")] + fields("parents", "parent") + LINK_FIELDS,
        lambda d, v, a: enroll_parents(d, v.get("student_code", ""), ParentEnrollmentInput(parents=parent_link(v)), a),
    ),
    "admission-form": (
        "Admission form", "admission_applications", [("admission_applications", "create")],
        lambda: fields("admission_applications", "application", skip=("status", "student_code"))
        + fields("application_guardians", "guardian", skip=("application_code", "parent_code"), optional=True)
        + fields("application_qualifications", "qualification", skip=("application_code",), optional=True),
        lambda d, v, a: admission_form(d, AdmissionFormInput(
            application=v.get("application", {}),
            guardians=[v["guardian"]] if v.get("guardian", {}).get("first_name") else [],
            qualifications=[v["qualification"]] if v.get("qualification", {}).get("qualification") else []), a),
    ),
    "onboard-teaching-staff": (
        "Teaching staff onboarding", "teachers", [("employees", "create"), ("teachers", "create")],
        lambda: fields("employees", "employee", skip=("employee_type",)) + fields("teachers", "teacher", skip=("employee_code",)),
        lambda d, v, a: onboard_teaching(d, TeachingStaffInput(employee=v.get("employee", {}), teacher=v.get("teacher", {})), a),
    ),
    "onboard-non-teaching-staff": (
        "Non-teaching staff onboarding", "staff_profiles", [("employees", "create"), ("staff_profiles", "create")],
        lambda: fields("employees", "employee", skip=("employee_type",)) + fields("staff_profiles", "staff_profile", skip=("employee_code",))
        + [field(f"pay.{k}", f"Pay: {label} ({kind}, monthly)", "number", False) for k, label, kind in PAY]
        + [field("pay.effective_from", "Pay: effective from", "date", False)],
        lambda d, v, a: onboard_non_teaching(d, NonTeachingStaffInput(
            employee=v.get("employee", {}), staff_profile=v.get("staff_profile", {}),
            salary_components=[{"component": label, "component_type": kind, "amount": str(v["pay"][k]),
                                **({"effective_from": v["pay"]["effective_from"]} if v.get("pay", {}).get("effective_from") else {})}
                               for k, label, kind in PAY if v.get("pay", {}).get(k) not in (None, "")]), a),
    ),
    "create-course": (
        "Create course", "programs", [("programs", "create"), ("batches", "create")],
        # The department is typed (existing ones are reused, new ones registered on the campus).
        lambda: [field("program.department_code", "Program: department (e.g. Science, Commerce)")]
        + fields("programs", "program", skip=("department_code",))
        + [field("campus_code", "Campus of a new department (only if there are several)", required=False,
                 reference="campuses")]
        + BATCH_FIELDS(False),
        # The first batch is optional here; when a start year is given the end year is required too.
        lambda d, v, a: create_course(d, CourseInput(program=v.get("program", {}),
                                                     batches=[v["batch"]] if v.get("batch", {}).get("entry_year") else []), a,
                                      campus_code=v.get("campus_code") or None),
    ),
    "create-batch": (
        "Year-based batch", "batches", [("batches", "create")],
        lambda: [field("program_code", "Course", reference="programs")] + BATCH_FIELDS(True)
        + fields("sections", "section", skip=("batch_code",), optional=True),
        lambda d, v, a: create_batch(d, v.get("program_code", ""), BatchInput(
            batch=v.get("batch", {}), sections=[v["section"]] if v.get("section", {}).get("name") else []), a),
    ),
    "course-fee-structure": (
        "Course fee structure", "fee_structures", [("fee_heads", "create"), ("fee_structures", "create")],
        lambda: [field("program_code", "Course", reference="programs"),
                 field("academic_year_code", "Academic year", reference="academic_years"),
                 field("year_of_study", "Year of study (1 = first year)", "number"),
                 field("due_date", "Due date", "date"),
                 field("currency", "Currency (default INR)", required=False)]
        + [field(f"amount.{key}", f"{name} ({'hostel students only' if cat == 'hostel' else 'bus users only' if cat == 'transport' else 'per year'})",
                 "number", False) for key, _, name, cat in FEE_HEADS],
        lambda d, v, a: course_fee_structure(d, v, a),
    ),
    "promote-batch": (
        "Move batch to a year of study", "batches", [("students", "edit")],
        lambda: [field("batch_code", "Batch", reference="batches"), field("to_year", "Year of study", "number")],
        lambda d, v, a: promote_batch(d, v, a),
    ),
    "enroll-students-to-course": (
        "Enroll students in a course", "student_enrollments", [("student_enrollments", "create")],
        lambda: [field("section_code", "Section", reference="sections"), field("enrolled_on", "Enrolled on", "date", False),
                 field("students", "Students: one 'STUDENT_CODE, ROLL_NUMBER' per line", "textarea")],
        lambda d, v, a: enroll_in_course(d, CourseEnrollmentInput(
            section_code=v.get("section_code", ""), enrolled_on=v.get("enrolled_on") or None,
            students=[{"student_code": s.strip(), "roll_number": r.strip()}
                      for line in str(v.get("students", "")).splitlines() if "," in line
                      for s, r in [line.split(",", 1)]]), a),
    ),
}


@router.get("/actions")
def actions(request: Request, user=Depends(current_user)):
    """Master data forms for the dashboard; each posts {values} to its path."""
    staff_only(user)
    data = request.app.state.store.snapshot()
    return {"actions": [
        {"key": key, "label": label, "resource": resource, "path": f"master-data/actions/{key}", "fields": build()}
        for key, (label, resource, grants, build, _) in ACTIONS.items()
        if all(has_permission(data, user, t, a) for t, a in grants)
    ]}


@router.post("/actions/{key}", status_code=201)
def run_action(key: str, body: ActionInput, request: Request, user=Depends(current_user)):
    staff_only(user)
    if key not in ACTIONS:
        raise HTTPException(404, "Unknown master data form")
    _, _, grants, _, handler = ACTIONS[key]
    with request.app.state.store.transaction() as data:
        need(data, user, *grants)
        try:
            return handler(data, nest(body.values), user["code"])
        except ValidationError as error:
            raise HTTPException(422, error.errors(include_url=False, include_context=False)) from None
