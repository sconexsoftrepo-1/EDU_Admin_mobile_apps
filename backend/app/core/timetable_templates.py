"""Editable weekly timetable documents. Uses record_extras on both SQL engines."""
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
    kind: Literal["theory", "lab", "activity"] = "theory"
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

    @model_validator(mode="after")
    def valid_grid(self):
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
        record = {**body.model_dump(), "code": code, "revision": body.revision + 1,
                  "course_name": course["name"], "batch_name": batch["name"],
                  "created_at": previous["created_at"] if previous else now(),
                  "updated_at": now(), "updated_by": user["code"]}
        rows[code] = record
        audit(data, user["code"], "update" if previous else "create", "timetable_templates", code)
    return record


@router.post("", status_code=201)
def create(body: Timetable, request: Request, user=Depends(current_user)):
    return save(body, request, user)


@router.put("/{code}")
def update(code: str, body: Timetable, request: Request, user=Depends(current_user)):
    return save(body, request, user, code)
