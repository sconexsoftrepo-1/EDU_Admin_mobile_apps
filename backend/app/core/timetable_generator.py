"""Build semester timetables for sections that have none.

For each academic batch in its current semester, every section without a published timetable
for that semester gets a Monday–Saturday week that repeats from the semester's first day to its
last day:

  09:00–09:50 P1 · 09:50–10:40 P2 · 10:40–10:55 break · 10:55–11:45 P3 · 11:45–12:35 P4
  12:35–13:20 lunch · 13:20–14:10 P5 · 14:10–15:00 P6

* each lab / practical subject gets a two-period block (P5–P6) once a week, in its registered lab;
* theory subjects share the remaining periods evenly, with the assigned faculty;
* one sports block (Saturday P5–P6) and one library period a week;
* a teacher is never placed in two sections at the same time (across all generated and existing
  published timetables); a period that cannot be staffed becomes a library / self-study period.

Timetables made by college staff are never changed. The seeded demo timetables (one period a
day, the same subject every day) are replaced by a full generated week.
"""
from .academic_progress import semester_state
from . import assignment_workspace as aw
from .curriculum_workspace import curriculum
from .lab_workspace import lab_for_subject, lab_subject, person
from .storage import new_code, now
from .timetable_templates import documents, semester_term

DEFAULT_PERIODS = [
    {"start": "09:00", "end": "09:50", "kind": "teaching", "label": "Period 1"},
    {"start": "09:50", "end": "10:40", "kind": "teaching", "label": "Period 2"},
    {"start": "10:40", "end": "10:55", "kind": "break", "label": "Short break"},
    {"start": "10:55", "end": "11:45", "kind": "teaching", "label": "Period 3"},
    {"start": "11:45", "end": "12:35", "kind": "teaching", "label": "Period 4"},
    {"start": "12:35", "end": "13:20", "kind": "lunch", "label": "Lunch"},
    {"start": "13:20", "end": "14:10", "kind": "teaching", "label": "Period 5"},
    {"start": "14:10", "end": "15:00", "kind": "teaching", "label": "Period 6"},
]
DAYS = range(6)  # Monday … Saturday


def bell_schedule(data):
    """The college's bell schedule, stored in the database (documents.timetable_settings).

    It is saved with the defaults the first time it is needed, and can be changed through
    PUT /academics/timetable-templates/bell-schedule; generated timetables follow it."""
    settings = data.setdefault("documents", {}).setdefault("timetable_settings", {})
    current = settings.get("bell_schedule")
    if not current or not current.get("periods"):
        current = {"code": "bell_schedule", "periods": [dict(p) for p in DEFAULT_PERIODS], "updated_at": now()}
        settings["bell_schedule"] = current
    return [dict(p) for p in current["periods"]]


def seeded_demo(timetable):
    """Synthetic demo timetables from the demo seed; these may be rebuilt."""
    return bool(timetable.get("demo_run")) or str(timetable.get("code", "")).startswith("DEMO-TT-")


def busy_teachers(data):
    """(day, row) → teacher names already busy in published (non-demo) timetables."""
    busy = {}
    for timetable in documents(data).values():
        if timetable.get("status") != "Published" or seeded_demo(timetable):
            continue
        periods = timetable.get("periods", [])
        for cell in timetable.get("cells", []):
            name = (cell.get("faculty") or "").strip()
            if not name:
                continue
            for row in range(cell["row"], cell["row"] + cell.get("span", 1)):
                if row < len(periods):
                    busy.setdefault((cell["day"], periods[row]["start"]), set()).add(name)
    return busy


def plan(data, on=None):
    """Return the timetables to create (not yet saved)."""
    records = data["records"]
    sections = records.get("sections", {})
    semesters = records.get("semesters", {})
    employees = records.get("employees", {})
    teachers = records.get("teachers", {})
    programs = records.get("programs", {})
    batches = records.get("batches", {})
    existing = {(t.get("batch_code"), t.get("section"), int(t.get("semester", 0)))
                for t in documents(data).values() if t.get("status") == "Published" and not seeded_demo(t)}
    demo = {}
    for t in documents(data).values():
        if seeded_demo(t):
            demo.setdefault((t.get("batch_code"), t.get("section"), int(t.get("semester", 0))), []).append(t["code"])
    offerings = {}
    for o in aw.rows(data, "subject_offerings"):
        offerings[(o["section_code"], o["subject_code"])] = o
    busy = busy_teachers(data)
    PERIODS = bell_schedule(data)
    TEACHING_ROWS = [i for i, p in enumerate(PERIODS) if p["kind"] == "teaching"]
    # Labs take the last two consecutive teaching periods of the day.
    LAB_ROWS = next(((a, b) for a, b in zip(TEACHING_ROWS[::-1][1:], TEACHING_ROWS[::-1]) if b == a + 1),
                    tuple(TEACHING_ROWS[-2:]))
    created = []
    for year in sorted(aw.rows(data, "academic_years"), key=lambda y: y["code"]):
        if not year.get("program_code"):
            continue
        try:
            current = semester_state(data, year, on)["current"]
            _, batch_sections, _ = aw.roster(data, year["code"], year["program_code"])
        except Exception:
            continue
        if not current:
            continue
        subjects = [s for s in curriculum(data, year["program_code"], year["code"])["items"]
                    if s["semester_number"] == current]
        if not subjects:
            continue
        for section_code in sorted(batch_sections):
            section = sections.get(section_code, {})
            linked = semesters.get(section.get("semester_code"), {}).get("semester_number")
            if linked and linked != current:
                continue
            batch = batches.get(section.get("batch_code"), {})
            if (batch.get("code"), section.get("name"), current) in existing:
                continue
            program = programs.get(year["program_code"], {})
            term = semester_term(data, batch, current)
            cells = []
            taken = set()

            def faculty_of(subject):
                o = offerings.get((section_code, subject["subject_code"]), {})
                return person(employees.get(teachers.get(o.get("teacher_code"), {}).get("employee_code"), {}))

            def free(name, day, rows):
                return not name or all(name not in busy.get((day, PERIODS[r]["start"]), set()) for r in rows)

            def place(day, rows, cell):
                for r in rows:
                    taken.add((day, r))
                    if cell.get("faculty"):
                        busy.setdefault((day, PERIODS[r]["start"]), set()).add(cell["faculty"])
                cells.append({"day": day, "row": rows[0], "span": len(rows), **cell})

            labs = [s for s in subjects if lab_subject(s)]
            theory = [s for s in subjects if not lab_subject(s)]
            # Sports: Saturday afternoon.
            place(5, list(LAB_ROWS), {"kind": "sports", "title": "Sports & games", "subject_code": "",
                                      "faculty": "", "room": "Playground"})
            # Labs: one double period a week each, on different days where possible.
            for i, subject in enumerate(labs):
                name = faculty_of(subject)
                for day in [(i + d) % 5 for d in range(5)]:
                    if all((day, r) not in taken for r in LAB_ROWS) and free(name, day, LAB_ROWS):
                        lab = lab_for_subject(data, subject["subject_code"], subject.get("name", ""))
                        place(day, list(LAB_ROWS), {"kind": "lab", "title": subject["name"],
                                                    "subject_code": subject["subject_code"], "faculty": name,
                                                    "room": f"{lab['name']} · Room {lab.get('room_number', '')}" if lab else ""})
                        break
            # Library: one period a week (Wednesday P6 if free).
            library_done = False
            for day, row in [(2, TEACHING_ROWS[-1]), (3, TEACHING_ROWS[-1]), (1, TEACHING_ROWS[-1]), (4, TEACHING_ROWS[len(TEACHING_ROWS) // 2])]:
                if (day, row) not in taken:
                    place(day, [row], {"kind": "library", "title": "Library", "subject_code": "", "faculty": "",
                                       "room": "Library"})
                    library_done = True
                    break
            # Theory: rotate through subjects so each gets a fair share of the remaining periods.
            pool = theory or labs
            turn = 0
            for day in DAYS:
                for row in TEACHING_ROWS:
                    if (day, row) in taken:
                        continue
                    chosen = None
                    for k in range(len(pool)):
                        subject = pool[(turn + k) % len(pool)]
                        name = faculty_of(subject)
                        if free(name, day, [row]):
                            chosen = (subject, name)
                            turn = turn + k + 1
                            break
                    if chosen:
                        subject, name = chosen
                        place(day, [row], {"kind": "theory", "title": subject["name"],
                                           "subject_code": subject["subject_code"], "faculty": name, "room": ""})
                    else:
                        place(day, [row], {"kind": "library", "title": "Library / self study", "subject_code": "",
                                           "faculty": "", "room": "Library"})
            code = new_code("TT")
            created.append({
                "code": code, "name": f"{program.get('name', '')} · {section.get('name', '')} · Semester {current}",
                "template": program.get("course_level") if program.get("course_level") in {"intermediate", "degree"} else "degree",
                "program_code": year["program_code"], "batch_code": batch.get("code"),
                "study_year": (current + 1) // 2, "semester": current, "section": section.get("name", ""),
                "coordinator": "", "status": "Published", "revision": 1, "periods": [dict(p) for p in PERIODS],
                "cells": cells, "valid_from": str(term["start_date"])[:10] if term else None,
                "valid_to": str(term["end_date"])[:10] if term else None,
                "course_name": program.get("name", ""), "batch_name": batch.get("name", ""),
                "created_at": now(), "updated_at": now(), "updated_by": None, "generated": True,
                "library_period": library_done,
                # Seeded demo timetables for the same class are replaced by this one.
                "replaces": demo.get((batch.get("code"), section.get("name"), current), []),
            })
            existing.add((batch.get("code"), section.get("name"), current))
    return created


def apply(data, timetables, actor=None):
    from .storage import audit
    rows = documents(data)
    for timetable in timetables:
        for old in timetable.get("replaces", []):
            rows.pop(old, None)
            audit(data, actor, "timetable_replace_demo", "timetable_templates", old)
        rows[timetable["code"]] = {k: v for k, v in {**timetable, "updated_by": actor}.items() if k != "replaces"}
        audit(data, actor, "timetable_generate", "timetable_templates", timetable["code"])
    return timetables
