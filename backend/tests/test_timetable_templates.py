import copy

import pytest

BASE = "/api/v1/academics/timetable-templates"


@pytest.fixture
def timetable_data(app):
    with app.state.store.transaction() as data:
        data["records"].setdefault("programs", {})["TEST-COURSE"] = {
            "code": "TEST-COURSE", "name": "B.Sc. Computer Science", "course_level": "degree",
        }
        data["records"].setdefault("batches", {})["TEST-BATCH"] = {
            "code": "TEST-BATCH", "name": "2026–2029", "program_code": "TEST-COURSE",
        }
    return {
        "name": "Computer Science weekly timetable", "template": "degree",
        "program_code": "TEST-COURSE", "batch_code": "TEST-BATCH",
        "periods": [{"start": "09:00", "end": "10:00"}, {"start": "10:00", "end": "11:00"},
                    {"start": "11:00", "end": "11:30", "kind": "break", "label": "Break"}],
        "cells": [{"day": 0, "row": 0, "span": 2, "kind": "lab", "title": "Computer lab"}],
    }


def test_save_reopen_edit_and_stale_revision(client, headers, timetable_data, app):
    created = client.post(BASE, headers=headers, json=timetable_data)
    assert created.status_code == 201, created.text
    record = created.json()
    assert record["revision"] == 1
    assert record["course_name"] == "B.Sc. Computer Science"
    assert client.get(BASE, headers=headers).json()["items"][0]["code"] == record["code"]
    update = {**timetable_data, "revision": 1, "name": "Updated timetable"}
    saved = client.put(f'{BASE}/{record["code"]}', headers=headers, json=update)
    assert saved.status_code == 200, saved.text
    assert saved.json()["revision"] == 2
    assert client.put(f'{BASE}/{record["code"]}', headers=headers, json=update).status_code == 409
    # The document lives in persistent storage, not a process-local cache.
    from app.core.storage import Store
    if isinstance(app.state.store, Store):
        snapshot = Store(app.state.store.directory).snapshot()
        assert snapshot["documents"]["timetables"][record["code"]]["name"] == "Updated timetable"


@pytest.mark.parametrize("problem", ["break", "overlap", "time", "batch", "level"])
def test_invalid_timetables_do_not_save(client, headers, timetable_data, problem):
    body = copy.deepcopy(timetable_data)
    if problem == "break":
        body["cells"][0]["span"] = 3
    elif problem == "overlap":
        body["cells"].append({"day": 0, "row": 1, "title": "Conflicting class"})
    elif problem == "time":
        body["periods"][1]["start"] = "09:30"
    elif problem == "batch":
        body["batch_code"] = "MISSING"
    else:
        body["template"] = "intermediate"
    result = client.post(BASE, headers=headers, json=body)
    assert result.status_code == 422, result.text
    assert client.get(BASE, headers=headers).json()["items"] == []


def test_publish_requires_filled_teaching_cells(client, headers, timetable_data):
    timetable_data["status"] = "Published"
    assert client.post(BASE, headers=headers, json=timetable_data).status_code == 422
    timetable_data["cells"] = [{"day": day, "row": 0, "span": 2, "title": "Practical"} for day in range(6)]
    assert client.post(BASE, headers=headers, json=timetable_data).status_code == 201


def test_allocated_non_admin_role_can_manage_and_view_only_cannot_write(client, headers, timetable_data, app):
    with app.state.store.transaction() as data:
        data["roles"]["ROOT"] = {"code": "ROOT", "name": "Timetable Officer", "screens": ["timetable"],
                                 "permissions": {"timetable_slots": ["view", "create", "edit"]}}
    assert client.get(BASE + "/options", headers=headers).status_code == 200
    assert client.post(BASE, headers=headers, json=timetable_data).status_code == 201
    with app.state.store.transaction() as data:
        data["roles"]["ROOT"]["permissions"] = {"timetable_slots": ["view"]}
    response = client.get(BASE, headers=headers)
    assert response.status_code == 200
    assert response.json()["can_create"] is False
    assert response.json()["can_edit"] is False
    assert client.post(BASE, headers=headers, json=timetable_data).status_code == 403
    with app.state.store.transaction() as data:
        data["roles"]["ROOT"]["screens"] = ["dashboard"]
    assert client.get(BASE, headers=headers).status_code == 403


def test_anonymous_cannot_read_timetables(client):
    assert client.get(BASE).status_code == 401


def test_document_sql_namespace_survives_cloning():
    from app.core.sql_store import Documents

    class Cursor:
        def execute(self, statement, params):
            assert params == ("document:timetables",)

        def fetchall(self):
            return [("TT-TEST", '{"revision": 1}')]

    class Session:
        def cursor(self):
            return Cursor()

    docs = Documents(Session())
    assert docs["timetables"]["TT-TEST"]["revision"] == 1
    cloned = docs.clone(Session())
    assert isinstance(cloned, Documents)
    cloned["timetables"]["TT-TEST"]["revision"] = 2
    assert docs["timetables"]["TT-TEST"]["revision"] == 1


def test_published_week_repeats_for_the_semester_in_the_student_app(client, headers, app):
    from datetime import date, timedelta
    from tests.test_lab_workspace import seed
    from tests.test_screen_workflows import mobile_login
    seed(app)
    data = app.state.store.snapshot()
    enrollment = next(e for e in data["records"]["student_enrollments"].values() if e.get("status") == "active")
    section = data["records"]["sections"][enrollment["section_code"]]
    batch = data["records"]["batches"][section["batch_code"]]
    program = data["records"]["programs"][batch["program_code"]]
    today = date.today()
    periods = [{"start": "09:00", "end": "10:00", "label": "Period 1"},
               {"start": "10:00", "end": "10:15", "kind": "break", "label": "Short break"},
               {"start": "10:15", "end": "11:15", "label": "Period 2"},
               {"start": "11:15", "end": "12:00", "kind": "lunch", "label": "Lunch"},
               {"start": "12:00", "end": "13:00", "label": "Period 3"}]
    kinds = ["theory", "lab", "sports", "library"]
    cells = [{"day": d, "row": r, "kind": kinds[(d + r) % 4], "title": f"{kinds[(d + r) % 4].title()} {d}{r}"}
             for d in range(6) for r in (0, 2, 4)]
    body = {"name": "Week", "template": program["course_level"], "program_code": program["code"],
            "batch_code": batch["code"], "section": section["name"], "status": "Published",
            "periods": periods, "cells": cells,
            "valid_from": (today - timedelta(days=30)).isoformat(), "valid_to": (today + timedelta(days=60)).isoformat()}
    saved = client.post(BASE, headers=headers, json=body)
    assert saved.status_code == 201, saved.text
    assert saved.json()["valid_from"] == body["valid_from"]

    student = mobile_login(client, app, "student", enrollment["student_code"], "student-mobile")
    items = client.get("/api/v1/mobile/workspace/timetable", headers=student).json()["items"]
    kinds_seen = {i["kind"] for i in items}
    assert {"theory", "lab", "sports", "library", "break", "lunch"} <= kinds_seen
    monday = [i for i in items if i["weekday"] == 1]
    assert [i["start_time"] for i in monday] == ["09:00", "10:00", "10:15", "11:15", "12:00"]
    assert all(i["valid_to"] == body["valid_to"] for i in items)

    # After the semester ends the week is no longer offered.
    ended = {**body, "revision": 1, "valid_from": (today - timedelta(days=90)).isoformat(),
             "valid_to": (today - timedelta(days=1)).isoformat()}
    assert client.put(f"{BASE}/{saved.json()['code']}", headers=headers, json=ended).status_code == 200
    items = client.get("/api/v1/mobile/workspace/timetable", headers=student).json()["items"]
    assert not any(i.get("timetable_code") == saved.json()["code"] for i in items)


def test_generate_semester_timetables_for_sections_without_one(client, headers, app):
    from tests.test_lab_workspace import seed
    from tests.test_screen_workflows import mobile_login
    seed(app)
    with app.state.store.transaction() as d:
        d["documents"]["timetables"] = {}  # no timetables yet
    preview = client.post(BASE + "/generate?preview=true", headers=headers).json()
    assert preview["preview"] and preview["count"] > 0
    assert app.state.store.snapshot()["documents"]["timetables"] == {}
    made = client.post(BASE + "/generate", headers=headers).json()
    assert made["count"] == preview["count"]
    timetables = app.state.store.snapshot()["documents"]["timetables"]
    for t in timetables.values():
        kinds = {c["kind"] for c in t["cells"]}
        assert {"theory", "sports", "library"} <= kinds and t["valid_from"] and t["valid_to"]
        filled = {(c["day"], r) for c in t["cells"] for r in range(c["row"], c["row"] + c["span"])}
        teaching = [r for r, p in enumerate(t["periods"]) if p["kind"] == "teaching"]
        assert all((d, r) in filled for d in range(6) for r in teaching)
    # No teacher is in two places at once.
    seen = {}
    for t in timetables.values():
        for c in t["cells"]:
            if c["faculty"]:
                for r in range(c["row"], c["row"] + c["span"]):
                    key = (c["faculty"], c["day"], t["periods"][r]["start"])
                    assert key not in seen, key
                    seen[key] = t["code"]
    # Running again creates nothing, and a teacher now sees their week.
    assert client.post(BASE + "/generate", headers=headers).json()["count"] == 0
    data = app.state.store.snapshot()
    teacher = next(iter(data["records"]["teachers"].values()))
    staff = mobile_login(client, app, "teacher", teacher["employee_code"], "teacher-mobile")
    week = client.get("/api/v1/mobile/workspace/timetable", headers=staff).json()["items"]
    assert any(i["kind"] in {"theory", "lab"} for i in week)
    assert {i["kind"] for i in week} >= {"break", "lunch"}


def test_generator_replaces_seeded_demo_timetables_with_a_real_week(client, headers, app):
    from tests.test_lab_workspace import seed
    from tests.test_screen_workflows import mobile_login
    seed(app)
    before = app.state.store.snapshot()["documents"]["timetables"]
    assert any(code.startswith("DEMO-TT-") for code in before)
    made = client.post(BASE + "/generate", headers=headers).json()
    assert made["count"] > 0 and any(t["replaces_demo"] for t in made["created"])
    after = app.state.store.snapshot()["documents"]["timetables"]
    current = {(t["batch_code"], t["section"], t["semester"]) for t in after.values() if not t["code"].startswith("DEMO-TT-")}
    assert not any((t["batch_code"], t["section"], t["semester"]) in current
                   for t in after.values() if t["code"].startswith("DEMO-TT-"))
    # A demo teacher now has different periods on different days, one section at a time.
    data = app.state.store.snapshot()
    teacher = next(iter(data["records"]["teachers"].values()))
    staff = mobile_login(client, app, "teacher", teacher["employee_code"], "teacher-mobile")
    week = [i for i in client.get("/api/v1/mobile/workspace/timetable?limit=200", headers=staff).json()["items"]
            if i["kind"] in {"theory", "lab"}]
    by_day = {d: sorted((i["start_time"], i["title"]) for i in week if i["weekday"] == d) for d in range(1, 7)}
    assert len({tuple(v) for v in by_day.values()}) > 1, by_day
    starts = [(i["weekday"], i["start_time"]) for i in week]
    assert len(starts) == len(set(starts)), "a teacher is never in two classes at once"
