"""Editable weekly timetable documents. Uses record_extras on both SQL engines.

A published timetable is the section's week (Monday–Saturday): classes, labs, sports, library,
breaks and lunch. The same week repeats from the semester's first day to its last day
(``valid_from`` / ``valid_to``, taken from the academic batch's semester calendar), and the apps show
it for any date in that range.
"""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field, model_validator

from .resources import staff_only
from .security import StrictModel, current_user, has_permission, role_limit
from .storage import audit, new_code, now

router = APIRouter(prefix="/academics/timetable-templates", tags=["Timetable templates"])


class Period(StrictModel):
    start: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    end: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    kind: Literal["teaching", "break", "lunch"] = "teaching"
    label: str = Field(default="", max_length=120)


class Cell(StrictModel):
    day: int = Field(ge=0, le=5)
    row: int = Field(ge=0, le=23)
    span: int = Field(default=1, ge=1, le=24)
    # theory = class; activity is kept for older timetables (shown as sports / activity).
    kind: Literal["theory", "lab", "sports", "library", "activity"] = "theory"
    title: str = Field(default="", max_length=180)
    subject_code: str = Field(default="", max_length=40)
    faculty: str = Field(default="", max_length=160)
    room: str = Field(default="", max_length=100)


class Timetable(StrictModel):
    name: str = Field(min_length=1, max_length=180)
    template: Literal["intermediate", "degree"]
    program_code: str = Field(min_length=1, max_length=100)
    batch_code: str = Field(min_length=1, max_length=100)
    study_year: int = Field(default=1, ge=1, le=10)
    semester: int = Field(default=1, ge=1, le=20)
    section: str = Field(default="A", min_length=1, max_length=40)
    coordinator: str = Field(default="", max_length=160)
    status: Literal["Draft", "Published"] = "Draft"
    revision: int = Field(default=0, ge=0)
    periods: list[Period] = Field(min_length=1, max_length=24)
    cells: list[Cell] = Field(default_factory=list, max_length=144)
    # The weekly timetable repeats between these dates; empty = the semester's dates.
    valid_from: date | None = None
    valid_to: date | None = None

    @model_validator(mode="after")
    def valid_grid(self):
        if self.valid_from and self.valid_to and self.valid_from > self.valid_to:
            raise ValueError("The timetable must end after it starts")
        for i, period in enumerate(self.periods):
            if period.start >= period.end:
                raise ValueError(f"Period {i + 1}: end must be after start")
            if i and period.start < self.periods[i - 1].end:
                raise ValueError(f"Period {i + 1} overlaps the previous period")
        occupied = set()
        for cell in self.cells:
            if cell.row + cell.span > len(self.periods):
                raise ValueError("A class extends beyond the final period")
            for row in range(cell.row, cell.row + cell.span):
                if self.periods[row].kind != "teaching":
                    raise ValueError("Classes cannot extend across a break or lunch")
                key = (cell.day, row)
                if key in occupied:
                    raise ValueError("Class boxes overlap")
                occupied.add(key)
        if self.status == "Published":
            filled = {(c.day, row) for c in self.cells if c.title.strip()
                      for row in range(c.row, c.row + c.span)}
            if any((day, row) not in filled for day in range(6)
                   for row, period in enumerate(self.periods) if period.kind == "teaching"):
                raise ValueError("Fill every teaching box before publishing; save a draft to finish later")
        return self


def access(data, user, action="view"):
    staff_only(user)
    allowed = role_limit(data, user, "screens")
    if allowed is not None and "timetable" not in allowed:
        raise HTTPException(403, "Timetable screen access required")
    if not has_permission(data, user, "timetable_slots", action):
        raise HTTPException(403, f"Timetable {action} permission required")


def documents(data):
    return data.setdefault("documents", {}).setdefault("timetables", {})


@router.get("")
def list_timetables(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    access(data, user)
    return {"items": sorted(documents(data).values(), key=lambda r: r["updated_at"], reverse=True),
            "can_create": has_permission(data, user, "timetable_slots", "create"),
            "can_edit": has_permission(data, user, "timetable_slots", "edit")}


@router.get("/options")
def options(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    access(data, user)
    # Timetable writers need academic labels, not unrestricted access to student/staff records.
    courses = [{k: r.get(k) for k in ("code", "name", "course_level", "duration_semesters")}
               for r in data["records"].get("programs", {}).values()]
    batches = [{k: r.get(k) for k in ("code", "name", "program_code", "entry_year", "graduation_year")}
               for r in data["records"].get("batches", {}).values()]
    return {"courses": courses, "batches": batches}


def save(body, request, user, code=None):
    with request.app.state.store.transaction() as data:
        access(data, user, "edit" if code else "create")
        rows = documents(data)
        previous = rows.get(code) if code else None
        if code and not previous:
            raise HTTPException(404, "Timetable not found")
        if body.revision != (previous["revision"] if previous else 0):
            raise HTTPException(409, "This timetable was changed by another user. Reopen the saved record before editing.")
        course = data["records"].get("programs", {}).get(body.program_code)
        batch = data["records"].get("batches", {}).get(body.batch_code)
        if not course or not batch or batch.get("program_code") != body.program_code:
            raise HTTPException(422, "Select a registered course and one of its batches")
        if course.get("course_level") in {"intermediate", "degree"} and course["course_level"] != body.template:
            raise HTTPException(422, "The course does not belong to the selected course level")
        code = code or new_code("TT")
        term = semester_term(data, batch, body.semester)
        valid_from = body.valid_from or (date.fromisoformat(str(term["start_date"])[:10]) if term else None)
        valid_to = body.valid_to or (date.fromisoformat(str(term["end_date"])[:10]) if term else None)
        record = {**body.model_dump(mode="json"), "code": code, "revision": body.revision + 1,
                  "valid_from": valid_from.isoformat() if valid_from else None,
                  "valid_to": valid_to.isoformat() if valid_to else None,
                  "course_name": course["name"], "batch_name": batch["name"],
                  "created_at": previous["created_at"] if previous else now(),
                  "updated_at": now(), "updated_by": user["code"]}
        rows[code] = record
        audit(data, user["code"], "update" if previous else "create", "timetable_templates", code)
    return record


@router.post("/generate")
def generate(request: Request, preview: bool = False, user=Depends(current_user)):
    """Create a semester timetable for every current-semester section that has none.

    ``preview=true`` only reports what would be created. Existing timetables are never changed."""
    from .timetable_generator import apply, plan

    def summary(made):
        return [{"code": t["code"], "name": t["name"], "section": t["section"], "semester": t["semester"],
                 "valid_from": t["valid_from"], "valid_to": t["valid_to"],
                 "replaces_demo": len(t.get("replaces", [])),
                 "periods": sum(1 for c in t["cells"] if c["kind"] in {"theory", "lab"})} for t in made]

    if preview:
        data = request.app.state.store.snapshot()
        access(data, user, "create")
        made = summary(plan(data))
        return {"created": made, "count": len(made), "preview": True}
    with request.app.state.store.transaction() as data:
        access(data, user, "create")
        made = summary(apply(data, plan(data), user["code"]))
    return {"created": made, "count": len(made), "preview": False}


@router.post("", status_code=201)
def create(body: Timetable, request: Request, user=Depends(current_user)):
    return save(body, request, user)


@router.put("/{code}")
def update(code: str, body: Timetable, request: Request, user=Depends(current_user)):
    return save(body, request, user, code)


def year_for_batch(data, batch):
    years = data["records"].get("academic_years", {})
    if batch.get("academic_year_code") in years:
        return years[batch["academic_year_code"]]
    return next((y for y in years.values() if y.get("batch_code") == batch.get("code")
                 or (y.get("program_code") == batch.get("program_code")
                     and str(y.get("start_date", ""))[:4] == str(batch.get("entry_year"))
                     and str(y.get("end_date", ""))[:4] == str(batch.get("graduation_year")))), None)


def semester_term(data, batch, semester):
    """The batch's semester (start and end dates) that a timetable belongs to."""
    from .academic_progress import calendar
    year = year_for_batch(data, batch or {})
    if not year:
        return None
    return next((t for t in calendar(data, year) if int(t["semester_number"]) == int(semester)), None)


KIND_LABEL = {"theory": "Class", "lab": "Lab", "sports": "Sports", "library": "Library", "activity": "Sports / activity",
              "break": "Break", "lunch": "Lunch"}


def weekly_timetable(data, sections, on=None, subjects_for=None):
    """The published weekly timetable for the given section codes, as one entry per period and day.

    Every day gets its break and lunch rows; boxes give classes, labs, sports and library. Only
    timetables whose semester range contains ``on`` (or that have no range) are used.
    ``subjects_for`` limits class/lab boxes to {section_code: {subject codes}} (a teacher's own).
    """
    from .academic_progress import local_now
    anchor = (on or local_now().date()).isoformat()
    records = data["records"]
    section_rows = {c: records.get("sections", {}).get(c, {}) for c in sections}
    subjects = records.get("subjects", {})
    # Each section follows its most recently published timetable for the date.
    chosen = {}
    batches = records.get("batches", {})
    programs = records.get("programs", {})
    for timetable in documents(data).values():
        if timetable.get("status") != "Published":
            continue
        valid_from, valid_to = timetable.get("valid_from"), timetable.get("valid_to")
        if not (valid_from and valid_to):
            # Older timetables carry no dates: they apply during their own semester.
            term = semester_term(data, batches.get(timetable.get("batch_code")), timetable.get("semester", 1))
            if term:
                valid_from = valid_from or str(term["start_date"])[:10]
                valid_to = valid_to or str(term["end_date"])[:10]
        if valid_from and anchor < str(valid_from)[:10]:
            continue
        if valid_to and anchor > str(valid_to)[:10]:
            continue
        timetable = {**timetable, "valid_from": valid_from, "valid_to": valid_to,
                     "course_name": timetable.get("course_name")
                     or programs.get(timetable.get("program_code"), {}).get("name"),
                     "batch_name": timetable.get("batch_name")
                     or batches.get(timetable.get("batch_code"), {}).get("name")}
        for c, s in section_rows.items():
            if s.get("batch_code") == timetable.get("batch_code") and s.get("name") == timetable.get("section"):
                if c not in chosen or str(timetable.get("updated_at", "")) > str(chosen[c].get("updated_at", "")):
                    chosen[c] = timetable
    result = []
    for section, timetable in chosen.items():
        periods = timetable.get("periods", [])
        own = subjects_for.get(section) if subjects_for is not None else None
        base = {"timetable_code": timetable["code"], "section_code": section, "section_name": timetable.get("section"),
                "course_name": timetable.get("course_name"), "batch_name": timetable.get("batch_name"),
                "semester": timetable.get("semester"), "valid_from": timetable.get("valid_from"),
                "valid_to": timetable.get("valid_to")}
        for day in range(6):
            for row, period in enumerate(periods):
                if period.get("kind") in {"break", "lunch"}:
                    result.append({**base, "code": f"{timetable['code']}:{day}:{row}", "weekday": day + 1,
                                   "start_time": period["start"], "end_time": period["end"], "kind": period["kind"],
                                   "title": period.get("label") or KIND_LABEL[period["kind"]]})
        for cell in timetable.get("cells", []):
            if not (cell.get("title") or "").strip() or cell.get("row", 0) >= len(periods):
                continue
            kind = cell.get("kind", "theory")
            if own is not None and kind in {"theory", "lab"} and cell.get("subject_code") not in own:
                continue
            if subjects_for is not None and own is None:
                continue
            last = min(cell["row"] + cell.get("span", 1) - 1, len(periods) - 1)
            result.append({**base, "code": f"{timetable['code']}:{cell['day']}:{cell['row']}",
                           "weekday": int(cell["day"]) + 1, "start_time": periods[cell["row"]]["start"],
                           "end_time": periods[last]["end"], "kind": kind,
                           "title": cell.get("title"), "subject_code": cell.get("subject_code") or None,
                           "subject_name": subjects.get(cell.get("subject_code") or "", {}).get("name"),
                           "faculty": cell.get("faculty") or None, "room": cell.get("room") or None,
                           "label": KIND_LABEL.get(kind, "Class")})
    return sorted(result, key=lambda r: (r["weekday"], r["start_time"], r["section_code"]))
