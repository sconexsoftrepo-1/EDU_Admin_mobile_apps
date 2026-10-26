"""Preview admission-number changes; use --apply to update existing students and branch codes.

Old numbers are retained in admission_number_history. Student codes, registrations, relationships,
and existing S3 object keys are preserved. Run from backend/ with the configured database.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.admission_numbers import branch_code, course_code, next_admission_number, validate_branch_code
from app.core.settings import Settings
from app.core.storage import audit, now
from create_master_data_role import store_for


def plan(data):
    records = data["records"]
    programs = {key: dict(value) for key, value in records.get("programs", {}).items()}
    students = {key: dict(value) for key, value in records.get("students", {}).items()}
    working = {"records": {"programs": programs, "students": students}}
    branches = []
    for program in programs.values():
        if program.get("course_level") in {"intermediate", "degree"}:
            code = validate_branch_code(working, program)
            if program.get("branch_code") != code:
                branches.append({"program_code": program["code"], "branch_code": code})
                program["branch_code"] = code
    profiles = {p["student_code"]: p for p in records.get("student_admission_profiles", {}).values()}
    years = records.get("academic_years", {})
    sections = records.get("sections", {})
    batches = records.get("batches", {})
    applications = records.get("admission_applications", {})
    enrollments = list(records.get("student_enrollments", {}).values())
    changes, skipped = [], []
    for student in sorted(students.values(), key=lambda row: (str(row.get("admission_date") or ""), row["code"])):
        profile = profiles.get(student["code"], {})
        application = applications.get(student.get("admission_application_code"), {})
        program_code = profile.get("program_code") or application.get("program_code")
        academic_year_code = profile.get("academic_year_code") or application.get("academic_year_code")
        if not program_code:
            linked = [e for e in enrollments if e.get("student_code") == student["code"]]
            for enrollment in sorted(linked, key=lambda row: str(row.get("enrolled_on") or "")):
                section = sections.get(enrollment.get("section_code"), {})
                program_code = batches.get(section.get("batch_code"), {}).get("program_code")
                if program_code:
                    break
        program = programs.get(program_code)
        year = years.get(academic_year_code, {}).get("start_date") or student.get("admission_date")
        if not program or program.get("course_level") not in {"intermediate", "degree"} or not year:
            skipped.append({"student_code": student["code"], "reason": "Course, level or admission year needs configuration"})
            continue
        start = int(str(year)[:4])
        prefix = f"{start % 100:02d}{course_code(program)}{branch_code(program)}"
        old = str(student["admission_number"])
        suffix = old[len(prefix):] if old.startswith(prefix) else ""
        if len(suffix) >= 4 and suffix.isdigit() and int(suffix) > 0:
            continue
        number = next_admission_number(working, program, start)
        changes.append({"student_code": student["code"], "old": old, "new": number})
        student["admission_number"] = number
    return {"branch_codes": branches, "admission_numbers": changes, "skipped": skipped}


def apply_plan(data, result):
    if result["skipped"]:
        raise ValueError("Configure the skipped students before applying the migration")
    for item in result["branch_codes"]:
        data["records"]["programs"][item["program_code"]]["branch_code"] = item["branch_code"]
        audit(data, None, "configure_admission_branch_code", "programs", item["program_code"])
    for item in result["admission_numbers"]:
        student = data["records"]["students"][item["student_code"]]
        history = list(student.get("admission_number_history") or [])
        history.append({"previous": item["old"], "replacement": item["new"], "changed_at": now()})
        student.update(admission_number=item["new"], admission_number_history=history)
        audit(data, None, "format_admission_number", "students", item["student_code"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    store = store_for(Settings())
    try:
        if args.apply:
            with store.transaction() as data:
                result = plan(data)
                apply_plan(data, result)
        else:
            result = plan(store.snapshot())
        print(json.dumps({"applied": args.apply, **result}, indent=2))
    finally:
        if hasattr(store, "close"):
            store.close()


if __name__ == "__main__":
    main()
