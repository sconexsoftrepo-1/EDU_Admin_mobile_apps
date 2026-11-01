"""Assign active faculty to every current-semester subject and lab that has no faculty yet.

For each academic batch's current semester, every section that teaches a subject without a
subject offering gets one, with the best-matching active teacher:
  1. a teacher whose specialization / qualification / department names the subject
     (e.g. "M.Sc. Botany" for "Botany 1" and "Botany lab 1"),
  2. otherwise the teacher with the fewest assigned subjects (load balancing).
Students of the section are linked to the new offering, exactly as the course faculty screen does.
Existing assignments are never changed, so it is safe to run again.

    python tools/assign_faculty.py            # dry run: print the plan
    python tools/assign_faculty.py --apply    # write
"""
import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core import assignment_workspace as aw
from app.core.academic_progress import semester_state
from app.core.curriculum_workspace import curriculum
from app.core.settings import Settings
from app.core.storage import audit, new_code
from create_master_data_role import store_for

STOP = {"and", "of", "the", "for", "lab", "laboratory", "practical", "practice", "i", "ii", "iii", "iv",
        "fundamentals", "foundations", "introduction", "advanced", "applied", "studies", "workshop"}


def words(text):
    return {w for w in re.findall(r"[a-z]+", str(text or "").lower()) if len(w) > 2 and w not in STOP}


def teacher_pool(data):
    employees = data["records"].get("employees", {})
    departments = data["records"].get("departments", {})
    # Onboarding profiles hold the specialization entered for each employee.
    profiles = {p["employee_code"]: p for p in aw.rows(data, "employee_profiles")}
    pool = []
    for t in aw.rows(data, "teachers"):
        e = employees.get(t.get("employee_code"), {})
        if e.get("status", "active") != "active":
            continue
        topic = " ".join(str(x or "") for x in (t.get("specialization"), t.get("qualification"), e.get("designation"),
                                                 departments.get(e.get("department_code"), {}).get("name"),
                                                 profiles.get(e.get("code"), {}).get("specialization")))
        pool.append({"code": t["code"], "name": " ".join(aw.name(e).split()) or t["code"], "words": words(topic)})
    return pool


def plan(data):
    """Return the offerings to create: [{subject, section, teacher, ...}]."""
    pool = teacher_pool(data)
    if not pool:
        return []
    load = {t["code"]: 0 for t in pool}
    existing = set()
    for o in aw.rows(data, "subject_offerings"):
        existing.add((o["subject_code"], o["section_code"]))
        if o.get("teacher_code") in load:
            load[o["teacher_code"]] += 1
    sections = data["records"].get("sections", {})
    semesters = data["records"].get("semesters", {})
    result = []
    for year in sorted(aw.rows(data, "academic_years"), key=lambda y: y["code"]):
        if not year.get("program_code"):
            continue
        try:
            current = semester_state(data, year)["current"]
            _, batch_sections, _ = aw.roster(data, year["code"], year["program_code"])
        except Exception:
            continue
        if not current:
            continue
        subjects = [s for s in curriculum(data, year["program_code"], year["code"])["items"] if s["semester_number"] == current]
        for section_code in sorted(batch_sections):
            section = sections.get(section_code, {})
            linked = semesters.get(section.get("semester_code"), {}).get("semester_number")
            if linked and linked != current:
                continue
            for subject in subjects:
                key = (subject["subject_code"], section_code)
                if key in existing:
                    continue
                wanted = words(subject.get("name"))
                best = max(pool, key=lambda t: (len(wanted & t["words"]), -load[t["code"]], t["code"]))
                load[best["code"]] += 1
                existing.add(key)
                result.append({"subject_code": subject["subject_code"], "subject_name": subject.get("name"),
                               "section_code": section_code, "section_name": section.get("name", ""),
                               "academic_year_code": year["code"], "academic_year_name": year.get("name", ""),
                               "teacher_code": best["code"], "teacher_name": best["name"],
                               "matched": bool(wanted & best["words"])})
    return result


def apply(data, rows, actor=None):
    offerings = data["records"].setdefault("subject_offerings", {})
    members = data["records"].setdefault("student_subjects", {})
    enrollments = aw.rows(data, "student_enrollments")
    for row in rows:
        offering = {"code": new_code("OFFER"), "subject_code": row["subject_code"], "section_code": row["section_code"],
                    "teacher_code": row["teacher_code"]}
        offerings[offering["code"]] = offering
        for e in enrollments:
            if e["section_code"] == row["section_code"] and e.get("status") == "active":
                key = new_code("SSUB")
                members[key] = {"code": key, "enrollment_code": e["code"], "offering_code": offering["code"]}
        audit(data, actor, "course_faculty_assign", "subject_offerings", offering["code"])


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    store = store_for(Settings())
    try:
        if not args.apply:
            rows = plan(store.snapshot())
            for r in rows:
                print(f"{r['academic_year_name']:<14} {r['section_name']:<6} {r['subject_name']:<40} -> {r['teacher_name']}"
                      f"{'' if r['matched'] else '  (by load)'}")
            print(f"{len(rows)} subject(s) to assign. Re-run with --apply to write.")
            return
        with store.transaction() as data:
            rows = plan(data)
            apply(data, rows)
        print(f"Assigned faculty to {len(rows)} subject(s).")
    finally:
        if hasattr(store, "close"):
            store.close()


if __name__ == "__main__":
    main()
