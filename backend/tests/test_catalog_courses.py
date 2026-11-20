"""B.Ed, ITI and D.P.Ed are added once per database, with subjects and labs per semester."""
from collections import Counter

from app.core import catalog_courses


def setup(app):
    with app.state.store.transaction() as d:
        d["records"].setdefault("campuses", {})["C"] = {"code": "C", "name": "Main"}


def test_courses_are_added_once_with_subjects_and_labs(app):
    setup(app)
    catalog_courses.ensure_catalog_courses(app)
    data = app.state.store.snapshot()
    programs = data["records"]["programs"]
    assert {c: (programs[c]["name"], programs[c]["duration_semesters"]) for c in ("BED-GEN", "ITI-GEN", "DPED-GEN")} == {
        "BED-GEN": ("B.Ed", 4), "ITI-GEN": ("ITI", 4), "DPED-GEN": ("D.P.Ed", 4)}
    links = Counter((l["program_code"], l["semester_number"]) for l in data["records"]["curriculum_subjects"].values())
    assert all(links[(c, n)] >= 4 for c in ("BED-GEN", "ITI-GEN", "DPED-GEN") for n in (1, 2, 3, 4))
    subjects = data["records"]["subjects"]
    iti = [subjects[l["subject_code"]] for l in data["records"]["curriculum_subjects"].values() if l["program_code"] == "ITI-GEN"]
    assert {"theory", "practical"} <= {s["subject_type"] for s in iti}
    # A course the college deletes later is never added back.
    with app.state.store.transaction() as d:
        for code in [k for k, l in d["records"]["curriculum_subjects"].items() if l["program_code"] == "ITI-GEN"]:
            d["records"]["curriculum_subjects"].pop(code)
        d["records"]["programs"].pop("ITI-GEN")
    catalog_courses.ensure_catalog_courses(app)
    assert "ITI-GEN" not in app.state.store.snapshot()["records"]["programs"]


def test_enrollment_options_list_the_new_levels(app, client, headers):
    setup(app)
    catalog_courses.ensure_catalog_courses(app)
    courses = client.get("/api/v1/master-data/enrollment/options", headers=headers).json()["courses"]
    assert {c["code"] for c in courses["bed"]} == {"BED-GEN"} and courses["iti"][0]["course_code"] == "ITI"
    assert courses["dped"][0]["name"] == "D.P.Ed"
