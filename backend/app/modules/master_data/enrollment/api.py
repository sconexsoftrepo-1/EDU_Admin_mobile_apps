"""Student enrollment wizard: one request enrolls a student completely.

Step 1 of the dashboard wizard collects the student, last qualification, guardian, Aadhaar,
referral, achievements, certifications and the document checklist; step 2 the course (level,
branch, academic year), hostel/bus and concessions with the fee breakdown; step 3 reviews and
confirms. POST /master-data/enrollment then writes, in one transaction: the student, the guardian
and link, the course enrollment (batch section), first-year fee charges (academic fees, plus hostel
or transport fees when chosen), concessions and the admission profile. Files (Aadhaar copy,
photo, certificates) are uploaded afterwards with POST /documents/upload (kind student_document,
document_label = checklist key), which marks the checklist entry as uploaded.

Fee structures are annual for these courses: fee_structures.semester_number holds the year of
study (1 = first year) and billing_frequency is "annual".
"""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.resources import staff_only
from app.core.security import current_user
from app.core.storage import audit, new_code

from ..onboarding.api import clean, create, link_parent, need, records, table_service
from ..onboarding.schemas import ParentLink
from .schemas import DOCUMENTS, IDENTITY_DOCUMENTS, EnrollmentInput, BatchEditInput

router = APIRouter(prefix="/master-data/enrollment", tags=["Master data entry"])

PROFILES = "student_admission_profiles"
FIRST_YEAR = 1
GRANTS = [("students", "create"), ("parents", "create"), ("student_parents", "create"),
          ("student_fee_charges", "create")]


def rows(data, table):
    return list(data["records"].get(table, {}).values())


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def year_of(data, academic_year_code):
    year = data["records"].get("academic_years", {}).get(academic_year_code)
    if not year:
        raise HTTPException(422, "Unknown academic year")
    return year, int(str(year["start_date"])[:4])


def next_admission_number(data, start_year):
    prefix = f"ADM-{start_year}-"
    used = [int(s["admission_number"][len(prefix):]) for s in rows(data, "students")
            if str(s.get("admission_number", "")).startswith(prefix) and s["admission_number"][len(prefix):].isdigit()]
    return f"{prefix}{max(used, default=0) + 1:04d}"


def next_registration_number(data, program_code, start_year):
    prefix = f"{program_code}-{start_year}-"
    used = [int(p["registration_number"][len(prefix):]) for p in rows(data, PROFILES)
            if str(p.get("registration_number", "")).startswith(prefix) and p["registration_number"][len(prefix):].isdigit()]
    return f"{prefix}{max(used, default=0) + 1:03d}"


def semester_labels(program):
    """Names of a course's semesters. Intermediate: year-term (1-1, 1-2, 2-1, 2-2 = 1st year 1st
    semester ...), used for marks, backlogs and records; degrees: Semester 1, Semester 2, ..."""
    count = int(program.get("duration_semesters") or 0)
    if program.get("course_level") == "intermediate":
        return [f"{(n - 1) // 2 + 1}-{(n - 1) % 2 + 1}" for n in range(1, count + 1)]
    return [f"Semester {n}" for n in range(1, count + 1)]


def fee_heads(data):
    return {h["code"]: h for h in rows(data, "fee_heads")}


def fee_lines(data, program_code, academic_year_code, hostel, transport, year_of_study=FIRST_YEAR):
    """Fee structures that apply: academic and other fees always, hostel/transport when chosen."""
    heads = fee_heads(data)
    wanted = {"academic", "other"} | ({"hostel"} if hostel else set()) | ({"transport"} if transport else set())
    lines = []
    for s in rows(data, "fee_structures"):
        if s["program_code"] != program_code or s["academic_year_code"] != academic_year_code:
            continue
        if s.get("fee_basis") == "full_course" and year_of_study != FIRST_YEAR:
            continue
        if s.get("fee_basis") != "full_course" and int(s["semester_number"]) != year_of_study:
            continue
        head = heads.get(s["fee_head_code"], {})
        category = head.get("category") or "academic"
        if category in wanted:
            lines.append({"fee_structure_code": s["code"], "fee_head_code": s["fee_head_code"],
                          "name": head.get("name", s["fee_head_code"]), "category": category,
                          "installment_number": int(s.get("installment_number") or 1),
                          "amount": str(money(s["amount"])), "due_date": s["due_date"],
                          "currency": s.get("currency", "INR"), "fee_basis": s.get("fee_basis", "annual"),
                          "term_count": s.get("term_count"), "term_due_dates": s.get("term_due_dates", [])})
    order = {"academic": 0, "other": 1, "hostel": 2, "transport": 3}
    return sorted(lines, key=lambda l: (order[l["category"]], l["name"], l["installment_number"]))


def courses(data):
    batches = rows(data, "batches")
    sections = rows(data, "sections")
    out = {"intermediate": [], "degree": []}
    for p in sorted(rows(data, "programs"), key=lambda p: (p.get("name") or "")):
        level = p.get("course_level")
        if level not in out:
            continue
        out[level].append({
            "code": p["code"], "name": p["name"], "branch": p.get("branch"),
            "qualification": p.get("qualification"), "duration_semesters": p.get("duration_semesters"),
            "category": p.get("category"), "duration_label": p.get("duration_label"),
            "semesters_label": p.get("semesters_label"), "subjects": p.get("subjects"),
            "career_opportunities": p.get("career_opportunities"),
            "semester_labels": semester_labels(p),
            "batches": [{"code": b["code"], "name": b["name"], "entry_year": b["entry_year"],
                         "sections": [{"code": s["code"], "name": s["name"], "semester_code": s.get("semester_code")}
                                      for s in sections if s["batch_code"] == b["code"]]}
                        for b in sorted(batches, key=lambda b: -int(b["entry_year"])) if b["program_code"] == p["code"]],
        })
    return out


@router.get("/options")
def options(request: Request, program_code: str | None = None, academic_year_code: str | None = None,
            hostel: bool = False, transport: bool = False, user=Depends(current_user)):
    """Everything the wizard needs: courses by level with branches and batches, academic years,
    campuses, the document checklist, and — for a chosen course and year — the next admission and
    registration numbers and the fee breakdown."""
    staff_only(user)
    data = request.app.state.store.snapshot()
    years = sorted(rows(data, "academic_years"), key=lambda y: str(y["start_date"]), reverse=True)
    result = {
        "courses": courses(data),
        "academic_years": [{"code": y["code"], "name": y["name"], "start_date": y["start_date"],
                            "end_date": y["end_date"]} for y in years],
        "campuses": [{"code": c["code"], "name": c["name"]} for c in rows(data, "campuses")],
        "documents": [{"key": k, "label": v} for k, v in DOCUMENTS.items()],
        "identity_documents": [{"key": k, "label": v} for k, v in IDENTITY_DOCUMENTS.items()],
    }
    if academic_year_code:
        _, start = year_of(data, academic_year_code)
        result["admission_number"] = next_admission_number(data, start)
        if program_code:
            result["registration_number"] = next_registration_number(data, program_code, start)
            result["fees"] = fee_lines(data, program_code, academic_year_code, hostel, transport)
            result["fees_available"] = fee_lines(data, program_code, academic_year_code, True, True)
    return result


def pick_batch(data, choice, start_year):
    batches = [b for b in rows(data, "batches") if b["program_code"] == choice.program_code]
    if choice.batch_code:
        batch = next((b for b in batches if b["code"] == choice.batch_code), None)
        if not batch:
            raise HTTPException(422, "The batch does not belong to the chosen course")
        return batch
    batch = next((b for b in batches if int(b["entry_year"]) == start_year), None)
    if not batch:
        raise HTTPException(409, f"Create the {start_year} batch of this course in Courses & enrollment first")
    return batch


def pick_section(data, choice, batch, academic_year_code):
    sections = [s for s in rows(data, "sections") if s["batch_code"] == batch["code"]]
    if choice.section_code:
        if not any(s["code"] == choice.section_code for s in sections):
            raise HTTPException(422, "The section does not belong to the batch")
        return choice.section_code
    semesters = {s["code"]: s for s in rows(data, "semesters")}
    current = [s for s in sections
               if semesters.get(s.get("semester_code"), {}).get("academic_year_code") == academic_year_code]
    ranked = sorted(current or sections, key=lambda s: (int(semesters.get(s.get("semester_code"), {}).get("semester_number") or 99), s["name"]))
    return ranked[0]["code"] if ranked else None


def employee_of(data, actor):
    account = data["accounts"].get(actor, {})
    code = account.get("person_code")
    if account.get("person_type") == "employee" and code in data["records"].get("employees", {}):
        return code
    return None


def apply_concession(data, charges, amount, kind, reason, approver, actor):
    """Spread a concession over the academic charges, largest first; returns the adjustments."""
    remaining, made = amount, []
    for charge in sorted(charges, key=lambda c: money(c["amount"]), reverse=True):
        if remaining <= 0:
            break
        part = min(remaining, money(charge["amount"]))
        adjustment = {"code": new_code("ADJ"), "charge_code": charge["code"], "adjustment_type": kind,
                      "amount": str(part), "reason": reason, "approved_by_code": approver}
        data["records"].setdefault("fee_adjustments", {})[adjustment["code"]] = adjustment
        audit(data, actor, "approve", "fee_adjustments", adjustment["code"])
        made.append(adjustment)
        remaining -= part
    return made


def enroll(data, body: EnrollmentInput, actor):
    choice = body.course
    program = data["records"].get("programs", {}).get(choice.program_code)
    if not program:
        raise HTTPException(422, "Unknown course")
    if program.get("course_level") != choice.course_level:
        raise HTTPException(422, "The course does not belong to the chosen level")
    if any(s.get("aadhaar_number") == body.student.aadhaar_number for s in rows(data, "students")):
        raise HTTPException(409, "A student with this Aadhaar number is already enrolled")
    unknown = set(body.documents) - set(DOCUMENTS)
    if unknown:
        raise HTTPException(422, "Unknown documents: " + ", ".join(sorted(unknown)))
    _, start_year = year_of(data, choice.academic_year_code)
    batch = pick_batch(data, choice, start_year)
    section_code = pick_section(data, choice, batch, choice.academic_year_code)
    campuses = rows(data, "campuses")
    campus = body.student.campus_code or (campuses[0]["code"] if len(campuses) == 1 else None)
    if not campus:
        raise HTTPException(422, "Choose the campus")

    admission_number = next_admission_number(data, start_year)
    registration_number = next_registration_number(data, choice.program_code, start_year)
    guardian = body.guardian
    q = body.last_qualification
    student = create(data, "students", {
        **body.student.model_dump(mode="json", exclude={"campus_code"}),
        "campus_code": campus,
        "admission_number": admission_number,
        "university_registration_number": registration_number,
        "admission_date": date.today().isoformat(),
        "admission_category": "regular",
        "status": "active",
        "current_year": FIRST_YEAR,
        "emergency_contact_name": f"{guardian.first_name} {guardian.last_name}",
        "emergency_contact_phone": guardian.phone,
        "previous_institution": q.institution,
        "previous_qualification": "10th class" if q.level == "ssc" else f"Intermediate {q.group or ''}".strip(),
        "previous_score": q.grade if q.level == "ssc" else q.second_year_score or q.first_year_score,
        "previous_education": q.model_dump(mode="json"),
    }, actor)

    links = [link_parent(data, student["code"], ParentLink(
        parent=clean(guardian.model_dump(mode="json", exclude={"relationship"})),
        relationship=guardian.relationship, is_primary=True, can_pickup=True), actor)]

    enrollment = None
    if section_code:
        enrollment = create(data, "student_enrollments", {
            "student_code": student["code"], "section_code": section_code, "roll_number": registration_number,
            "enrolled_on": date.today().isoformat(), "status": "active"}, actor)

    lines = fee_lines(data, choice.program_code, choice.academic_year_code, body.hostel_required, body.transport_required)
    charges = []
    for line in lines:
        charge = create(data, "student_fee_charges", {
            "student_code": student["code"], "fee_structure_code": line["fee_structure_code"],
            "amount": line["amount"], "due_date": line["due_date"], "tax_amount": "0.00"}, actor)
        charges.append(charge)
        line["charge_code"] = charge["code"]
    gross = sum((money(l["amount"]) for l in lines), Decimal("0.00"))
    scholarship = money(body.scholarship.amount) if body.scholarship else Decimal("0.00")
    special = money(body.special_consideration.amount) if body.special_consideration else Decimal("0.00")
    if special and not (body.special_consideration.reason or "").strip():
        raise HTTPException(422, "Give the reason for the special consideration")
    academic = [c for c, l in zip(charges, lines) if l["category"] in {"academic", "other"}]
    if scholarship + special > sum((money(c["amount"]) for c in academic), Decimal("0.00")):
        raise HTTPException(422, "Scholarship and special consideration exceed the academic fee")

    approver = employee_of(data, actor)
    concessions = []
    for amount, kind, label in ((scholarship, "waiver", "Scholarship"), (special, "discount", "Special consideration")):
        if not amount:
            continue
        detail = body.scholarship if kind == "waiver" else body.special_consideration
        reason = f"{label}: {detail.name or detail.reason or 'as recorded at enrollment'}"
        entry = {"type": kind, "label": label, "amount": str(amount), "reason": reason,
                 "status": "applied" if approver else "pending_approval"}
        if approver:
            entry["adjustments"] = [a["code"] for a in apply_concession(data, academic, amount, kind, reason, approver, actor)]
        concessions.append(entry)

    profile = {
        "code": new_code("SAP"),
        "student_code": student["code"],
        "program_code": choice.program_code,
        "academic_year_code": choice.academic_year_code,
        "batch_code": batch["code"],
        "section_code": section_code,
        "course_level": choice.course_level,
        "registration_number": registration_number,
        "last_qualification": q.model_dump(mode="json"),
        "referral": body.referral.model_dump(mode="json") if body.referral else None,
        "achievements": [a.model_dump(mode="json") for a in body.achievements],
        "certifications": [c.model_dump(mode="json") for c in body.certifications],
        "document_checklist": {
            **{k: {"label": DOCUMENTS[k], "submitted": v, "uploaded": False} for k, v in body.documents.items()},
            **{k: {"label": v, "submitted": True, "uploaded": False} for k, v in IDENTITY_DOCUMENTS.items()},
        },
        "hostel_required": body.hostel_required,
        "transport_required": body.transport_required,
        "scholarship_amount": str(scholarship),
        "scholarship_name": body.scholarship.name if body.scholarship else None,
        "special_consideration_amount": str(special),
        "special_consideration_reason": body.special_consideration.reason if body.special_consideration else None,
        "gross_fee": str(gross),
        "net_fee": str(gross - scholarship - special),
        "fee_summary": [*lines, *({"category": "concession", **c} for c in concessions)],
        "created_by_user_code": actor,
    }
    data["records"].setdefault(PROFILES, {})[profile["code"]] = profile
    audit(data, actor, "create", PROFILES, profile["code"])
    return {"student": student, "parents": links, "enrollment": enrollment, "profile": profile,
            "charges": charges, "program": program, "batch": batch}


@router.post("", status_code=201)
def post_enrollment(body: EnrollmentInput, request: Request, user=Depends(current_user)):
    staff_only(user)
    with request.app.state.store.transaction() as data:
        need(data, user, *GRANTS)
        return enroll(data, body, user["code"])


@router.get("/courses/{program_code}/insights")
def course_insights(program_code: str, request: Request, user=Depends(current_user)):
    """A course with its year-wise batches and high-level counts of the students in each batch:
    total, by current year of study, by gender, hostel and bus users, fees raised (gross / net)."""
    staff_only(user)
    data = request.app.state.store.snapshot()
    need(data, user, ("programs", "view"))
    program = data["records"].get("programs", {}).get(program_code)
    if not program:
        raise HTTPException(404, "Course not found")
    batches = sorted((b for b in rows(data, "batches") if b["program_code"] == program_code),
                     key=lambda b: int(b["entry_year"]), reverse=True)
    sections = {s["code"]: s for s in rows(data, "sections")}
    profiles = {p["student_code"]: p for p in rows(data, PROFILES) if p["program_code"] == program_code}
    students = data["records"].get("students", {})
    members = {b["code"]: set() for b in batches}
    for p in profiles.values():
        if p.get("batch_code") in members:
            members[p["batch_code"]].add(p["student_code"])
    for e in rows(data, "student_enrollments"):
        batch = sections.get(e["section_code"], {}).get("batch_code")
        if batch in members and e.get("status", "active") == "active":
            members[batch].add(e["student_code"])

    def summary(codes):
        people = [students[c] for c in codes if c in students]
        by_year, by_gender = {}, {}
        for st in people:
            year = str(st.get("current_year") or 1)
            by_year[year] = by_year.get(year, 0) + 1
            gender = st.get("gender") or "unknown"
            by_gender[gender] = by_gender.get(gender, 0) + 1
        own = [profiles[c] for c in codes if c in profiles]
        return {
            "students": len(people),
            "active": sum(1 for st in people if st.get("status") == "active"),
            "by_current_year": dict(sorted(by_year.items())),
            "by_gender": by_gender,
            "hostel": sum(1 for p in own if p.get("hostel_required")),
            "transport": sum(1 for p in own if p.get("transport_required")),
            "gross_fee": str(sum((money(p.get("gross_fee")) for p in own), Decimal("0.00"))),
            "net_fee": str(sum((money(p.get("net_fee")) for p in own), Decimal("0.00"))),
        }

    section_members = {code: set() for code in sections}
    for profile in profiles.values():
        section_code = profile.get("section_code")
        if section_code in section_members:
            section_members[section_code].add(profile["student_code"])
    for enrollment in rows(data, "student_enrollments"):
        section_code = enrollment.get("section_code")
        if section_code in section_members and enrollment.get("status", "active") == "active":
            section_members[section_code].add(enrollment["student_code"])
    years = max(1, (int(program.get("duration_semesters") or 2) + 1) // 2)
    out = []
    for b in batches:
        item = {"code": b["code"], "name": b["name"], "entry_year": b["entry_year"],
                "graduation_year": b.get("graduation_year") or int(b["entry_year"]) + years,
                "sections": [{"code": s["code"], "name": s["name"], "capacity": s.get("capacity"),
                              "students": len(section_members[s["code"]] & members[b["code"]] & set(students))}
                             for s in sections.values()
                             if s["batch_code"] == b["code"]],
                **summary(members[b["code"]])}
        out.append(item)
    everyone = set().union(*members.values()) if members else set()
    capacity = program.get("intake_capacity")
    return {"program": program, "years": years, "semester_labels": semester_labels(program), "batches": out,
            "totals": {**summary(everyone), "batches": len(batches),
                       "intake_capacity": capacity}}


@router.get("/batches/overview")
def batch_overview(request: Request, program_code: str | None = None, user=Depends(current_user)):
    """All-course batch cards in one request; count distinct students, not enrollment rows."""
    staff_only(user)
    data = request.app.state.store.snapshot()
    need(data, user, ("programs", "view"), ("batches", "view"))
    programs = {p["code"]: p for p in rows(data, "programs")}
    if program_code and program_code not in programs:
        raise HTTPException(404, "Course not found")
    batches = {b["code"]: b for b in rows(data, "batches") if not program_code or b["program_code"] == program_code}
    sections = {s["code"]: s for s in rows(data, "sections") if s["batch_code"] in batches}
    students = {s["code"] for s in rows(data, "students")}
    members = {code: set() for code in batches}
    section_members = {code: set() for code in sections}
    for profile in rows(data, PROFILES):
        student = profile["student_code"]
        if student not in students:
            continue
        if profile.get("batch_code") in members:
            members[profile["batch_code"]].add(student)
        if profile.get("section_code") in section_members:
            section_members[profile["section_code"]].add(student)
    for enrollment in rows(data, "student_enrollments"):
        section = sections.get(enrollment.get("section_code"))
        student = enrollment["student_code"]
        if section and student in students and enrollment.get("status", "active") == "active":
            members[section["batch_code"]].add(student)
            section_members[section["code"]].add(student)
    result = []
    for batch in batches.values():
        program = programs.get(batch["program_code"], {})
        result.append({"code": batch["code"], "name": batch["name"], "program_code": batch["program_code"],
                       "course_name": program.get("name") or batch["program_code"], "entry_year": batch["entry_year"],
                       "graduation_year": batch.get("graduation_year") or int(batch["entry_year"]) + max(1, (int(program.get("duration_semesters") or 2) + 1) // 2),
                       "students": len(members[batch["code"]]),
                       "sections": [{"code": section["code"], "name": section["name"], "capacity": section.get("capacity"),
                                     "students": len(section_members[section["code"]])}
                                    for section in sections.values() if section["batch_code"] == batch["code"]]})
    result.sort(key=lambda b: (b["course_name"].casefold(), -int(b["entry_year"]), b["code"]))
    all_students = set().union(*members.values()) if members else set()
    return {"batches": result, "totals": {"batches": len(result), "students": len(all_students)}}


@router.patch("/batches/{batch_code}")
def update_batch_details(batch_code: str, body: BatchEditInput, request: Request, user=Depends(current_user)):
    """Save a batch's year range and section names atomically."""
    staff_only(user)
    if body.graduation_year <= body.entry_year:
        raise HTTPException(422, "End year must be after start year")
    if len({s.code for s in body.sections}) != len(body.sections):
        raise HTTPException(422, "A section may only appear once")
    with request.app.state.store.transaction() as data:
        need(data, user, ("batches", "edit"))
        table_service("batches").repo.get(data, batch_code)
        if body.sections:
            need(data, user, ("sections", "edit"))
        for section in body.sections:
            record = table_service("sections").repo.get(data, section.code)
            if record["batch_code"] != batch_code:
                raise HTTPException(422, "The section does not belong to this batch")
            if not section.name.strip():
                raise HTTPException(422, "Section name cannot be empty")
        batch = table_service("batches").update(data, batch_code, {
            "entry_year": body.entry_year, "graduation_year": body.graduation_year,
            "name": f"{body.entry_year}–{body.graduation_year}"}, user["code"])
        for section in body.sections:
            table_service("sections").update(data, section.code, {"name": section.name.strip()}, user["code"])
        return {"batch": batch, "sections_updated": len(body.sections)}


@router.get("/{student_code}")
def enrollment_review(student_code: str, request: Request, user=Depends(current_user)):
    """Everything recorded at enrollment, for the review card, print-out, PDF and CSV."""
    staff_only(user)
    data = request.app.state.store.snapshot()
    need(data, user, ("students", "view"))
    student = data["records"].get("students", {}).get(student_code)
    profile = next((p for p in rows(data, PROFILES) if p["student_code"] == student_code), None)
    if not student or not profile:
        raise HTTPException(404, "Enrollment not found")
    parents = {p["code"]: p for p in rows(data, "parents")}
    links = [{**l, "parent": parents.get(l["parent_code"])} for l in rows(data, "student_parents")
             if l["student_code"] == student_code]
    documents = [d for d in rows(data, "documents") if d.get("student_code") == student_code]
    return {"student": student, "profile": profile, "parents": links,
            "program": data["records"].get("programs", {}).get(profile["program_code"]),
            "batch": data["records"].get("batches", {}).get(profile.get("batch_code")),
            "documents": [{k: d.get(k) for k in ("code", "document_type", "original_filename", "mime_type")}
                          for d in documents]}


def promote_students(data, batch_code, to_year, actor):
    """Current-year management: move every student of a batch to a year of study."""
    batch = data["records"].get("batches", {}).get(batch_code)
    if not batch:
        raise HTTPException(404, "Batch not found")
    program = data["records"].get("programs", {}).get(batch["program_code"], {})
    years = max(1, (int(program.get("duration_semesters") or 2) + 1) // 2)
    if not 1 <= to_year <= max(years, 1):
        raise HTTPException(422, f"Year of study must be between 1 and {years} for this course")
    codes = {p["student_code"] for p in rows(data, PROFILES) if p.get("batch_code") == batch_code}
    codes |= {e["student_code"] for e in rows(data, "student_enrollments")
              if data["records"].get("sections", {}).get(e["section_code"], {}).get("batch_code") == batch_code}
    students = data["records"].get("students", {})
    for code in sorted(codes):
        if code in students and students[code].get("current_year") != to_year:
            students[code]["current_year"] = to_year
            audit(data, actor, "edit", "students", code)
    return {"batch_code": batch_code, "current_year": to_year, "students": len(codes)}


@router.post("/promote", status_code=200)
def promote(request: Request, batch_code: str = Query(...), to_year: int = Query(..., ge=1, le=10),
            user=Depends(current_user)):
    staff_only(user)
    with request.app.state.store.transaction() as data:
        need(data, user, ("students", "edit"))
        return promote_students(data, batch_code, to_year, user["code"])
