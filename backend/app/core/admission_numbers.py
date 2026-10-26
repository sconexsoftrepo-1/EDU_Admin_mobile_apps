"""Admission numbers allocated inside the store's serialized enrollment transaction."""

import hashlib
import re

from fastapi import HTTPException

COURSE_CODES = {"intermediate": "INT", "degree": "DEG"}


def branch_code(program):
    """Use an explicit code, otherwise derive a stable code from the unique program code."""
    configured = program.get("branch_code")
    if configured:
        value = str(configured).strip().upper()
        if not re.fullmatch(r"[A-Z0-9]{1,40}", value):
            raise HTTPException(422, "Branch code must contain 1–40 uppercase letters or digits")
        return value
    value = str(program.get("code") or "").upper()
    course = COURSE_CODES.get(program.get("course_level"))
    if course:
        value = re.sub(rf"^{course}[-_]", "", value)
    value = re.sub(r"[^A-Z0-9]", "", value)
    if not value:
        raise HTTPException(422, "Configure a branch code for this course before enrolling students")
    if len(value) > 40:
        value = value[:30] + hashlib.sha256(str(program["code"]).encode()).hexdigest()[:10].upper()
    return value


def course_code(program):
    value = COURSE_CODES.get(program.get("course_level"))
    if not value:
        raise HTTPException(422, "Set the course level to Intermediate or Degree before enrolling students")
    return value


def validate_branch_code(data, program):
    """Keep each course/branch prefix unambiguous, including legacy course rows."""
    level = program.get("course_level")
    value = branch_code(program)
    for other in data["records"].get("programs", {}).values():
        if other["code"] != program["code"] and other.get("course_level") == level:
            if branch_code(other) == value:
                raise HTTPException(409, "Branch code is already used by another course at this level; choose a unique branch code")
    return value


def next_admission_number(data, program, start_year):
    """Preview or allocate YY + course type + branch code + a minimum four-digit sequence.

    Previews do not reserve numbers. Writes must call this again inside the store transaction;
    all SQL/JSON stores serialize writers, and students.admission_number is unique in SQL.
    """
    prefix = f"{int(start_year) % 100:02d}{course_code(program)}{validate_branch_code(data, program)}"
    numbers = {str(row.get("admission_number") or "") for row in data["records"].get("students", {}).values()}
    used = [int(number[len(prefix):]) for number in numbers
            if number.startswith(prefix) and number[len(prefix):].isdigit()]
    sequence = max(used, default=0) + 1
    candidate = f"{prefix}{sequence:04d}"
    while candidate in numbers:
        sequence += 1
        candidate = f"{prefix}{sequence:04d}"
    return candidate
