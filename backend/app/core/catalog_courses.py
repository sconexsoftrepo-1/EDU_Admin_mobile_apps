"""B.Ed, ITI and D.P.Ed: created once in each database, with their subjects and labs per semester.

Runs at backend start-up. A course is added only when no course of that level exists yet, and a
marker (documents "catalog_courses") records that this database was set up, so a course the college
later renames, edits or deletes is never added back. Subjects can be changed afterwards in the
course's semester workspace, like any other course.
"""
import logging

T, P = "theory", "practical"

COURSES = [
    {
        # Single-branch courses: the branch is the course level itself, so the course reads "B.Ed".
        "course_level": "bed", "branch": "B.Ed", "branch_code": "GEN",
        "duration_years": 2, "duration_semesters": 4,
        "semester_labels": ["Semester 1", "Semester 2", "Semester 3", "Semester 4"],
        "details": "Bachelor of Education: two-year teacher education programme (NCTE pattern) with school internship.",
        "subjects": {
            1: [("Childhood and Growing Up", T), ("Contemporary India and Education", T),
                ("Learning and Teaching", T), ("Language across the Curriculum", T),
                ("Understanding Disciplines and Subjects", T),
                ("Reading and Reflecting on Texts", P), ("School Observation", P)],
            2: [("Knowledge and Curriculum", T), ("Assessment for Learning", T),
                ("Pedagogy of a School Subject - Part I", T), ("Pedagogy of a School Subject - Part II", T),
                ("Micro-teaching", P), ("Critical Understanding of ICT", P)],
            3: [("Pedagogy of a School Subject - Advanced", T), ("School Internship", P),
                ("Teaching Practice and Lesson Plans", P), ("Drama and Art in Education", P)],
            4: [("Gender, School and Society", T), ("Creating an Inclusive School", T),
                ("Educational Psychology and Guidance", T), ("Optional Course (Peace / Health / Environment Education)", T),
                ("Understanding the Self", P), ("Health, Physical Education and Yoga", P),
                ("Final Teaching Practice", P)],
        },
    },
    {
        "course_level": "iti", "branch": "ITI", "branch_code": "GEN",
        "duration_years": 2, "duration_semesters": 4,
        "semester_labels": ["Semester 1", "Semester 2", "Semester 3", "Semester 4"],
        "details": "Industrial Training Institute course (NCVT pattern): trade theory, practicals and on-the-job training.",
        "subjects": {
            1: [("Trade Theory I", T), ("Workshop Calculation and Science I", T), ("Engineering Drawing I", T),
                ("Employability Skills I", T), ("Trade Practical I", P), ("Basic Workshop Practice", P)],
            2: [("Trade Theory II", T), ("Workshop Calculation and Science II", T), ("Engineering Drawing II", T),
                ("Employability Skills II", T), ("Trade Practical II", P), ("Computer Fundamentals Lab", P)],
            3: [("Trade Theory III", T), ("Workshop Calculation and Science III", T), ("Engineering Drawing III", T),
                ("Employability Skills III", T), ("Trade Practical III", P), ("Safety and Maintenance Practice", P)],
            4: [("Trade Theory IV", T), ("Workshop Calculation and Science IV", T), ("Engineering Drawing IV", T),
                ("Employability Skills IV", T), ("Trade Practical IV", P), ("On-the-job Training / Project", P)],
        },
    },
    {
        "course_level": "dped", "branch": "D.P.Ed", "branch_code": "GEN",
        "duration_years": 2, "duration_semesters": 4,
        "semester_labels": ["Semester 1", "Semester 2", "Semester 3", "Semester 4"],
        "details": "Diploma in Physical Education: two-year course (NCTE pattern) with games, athletics and teaching practice.",
        "subjects": {
            1: [("History, Principles and Foundations of Physical Education", T), ("Anatomy and Physiology", T),
                ("Health Education and Environmental Studies", T),
                ("Track and Field (Athletics) I", P), ("Gymnastics", P), ("Yoga and Calisthenics", P)],
            2: [("Psychology in Physical Education", T), ("Educational Technology in Physical Education", T),
                ("Officiating and Coaching I", T),
                ("Indigenous Games (Kabaddi, Kho-Kho)", P), ("Track and Field (Athletics) II", P), ("Aerobics and Rhythmic Activities", P)],
            3: [("Sports Training", T), ("Organisation and Administration of Physical Education", T),
                ("Officiating and Coaching II", T),
                ("Team Games (Football, Volleyball, Basketball)", P), ("Teaching Practice I", P), ("Swimming", P)],
            4: [("Measurement and Evaluation in Physical Education", T), ("Sports Medicine, First Aid and Rehabilitation", T),
                ("Recreation, Camping and Leadership", T),
                ("Racket Games (Badminton, Table Tennis)", P), ("Teaching Practice II", P), ("Fitness Testing Lab", P)],
        },
    },
]
MARKER = "catalog_courses"
VERSION = "bed-iti-dped-v1"


def add_courses(data, actor="system"):
    """Create each listed course whose level has no course yet; returns the codes created."""
    from app.modules.master_data.onboarding.api import table_service
    programs = data["records"].setdefault("programs", {})
    service = table_service("programs")
    created = []
    for course in COURSES:
        if any(p.get("course_level") == course["course_level"] for p in programs.values()):
            continue
        body = {k: course[k] for k in ("course_level", "branch", "branch_code", "duration_years",
                                         "duration_semesters", "semester_labels", "details")}
        body["subject_entries"] = [{"name": name, "semester_number": n, "subject_type": kind}
                                   for n, items in course["subjects"].items() for name, kind in items]
        created.append(service.create(data, body, actor)["code"])
    return created


def ensure_catalog_courses(app):
    """Start-up: add B.Ed, ITI and D.P.Ed once per database (see the module docstring)."""
    from contextlib import nullcontext
    store = app.state.store
    try:
        with store.request_scope() if hasattr(store, "request_scope") else nullcontext():
            # One marker row per version; SQL Server stores each row as a JSON object (ISJSON check).
            if VERSION in (store.snapshot().get("documents", {}).get(MARKER) or {}):
                return
            with store.transaction() as data:
                done = data.setdefault("documents", {}).setdefault(MARKER, {})
                if VERSION in done:
                    return
                if not data["records"].get("campuses"):
                    return  # a brand-new database: courses need a campus first; tried again next start
                created = add_courses(data)
                done[VERSION] = {"created": created}
        if created:
            logging.getLogger(__name__).info("Added courses: %s", ", ".join(created))
    except Exception:
        logging.getLogger(__name__).exception("Could not add the B.Ed / ITI / D.P.Ed courses; tried again next start")
