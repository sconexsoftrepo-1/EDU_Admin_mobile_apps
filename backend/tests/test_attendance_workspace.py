from datetime import timedelta

import pytest

from app.core.attendance_workspace import today
from app.core.security import current_user

BASE = "/api/v1/academics/attendance-workspace"
DAY = "2020-10-05"


@pytest.fixture
def attendance_data(app):
    with app.state.store.transaction() as data:
        def put(table, code, **values):
            data["records"].setdefault(table, {})[code] = {"code": code, **values}
        for n in (1, 2):
            put("programs", f"P{n}", name=f"Course {n}", course_level="degree", branch="Computing")
            put("academic_years", f"Y{n}", name="2019–2023", program_code=f"P{n}", batch_code=f"B{n}", start_date="2019-06-01", end_date="2023-05-31")
            put("batches", f"B{n}", name="2019–2023", program_code=f"P{n}", academic_year_code=f"Y{n}", entry_year=2019, graduation_year=2023)
            put("sections", f"S{n}", name="A", batch_code=f"B{n}")
        put("teachers", "T1", employee_code="EMP1")
        put("subject_offerings", "O1", section_code="S1", teacher_code="T1", subject_code="CS")
        for n in (1, 2, 3):
            cohort = 2 if n == 3 else 1
            put("students", f"ST{n}", first_name=f"Student {n}", status="active", admission_number=f"ADM{n}")
            put("student_admission_profiles", f"AP{n}", student_code=f"ST{n}", program_code=f"P{cohort}", academic_year_code=f"Y{cohort}")
            put("student_enrollments", f"EN{n}", student_code=f"ST{n}", section_code=f"S{cohort}", status="active")
        put("student_parents", "LINK", student_code="ST1", parent_code="PAR1")
        put("student_leave_requests", "LEAVE", student_code="ST1", start_date=DAY, end_date=DAY, status="approved")
        data["roles"]["TEACH"] = {"code": "TEACH", "scope": "teaching", "screens": ["attendance"], "permissions": {}}
        data["accounts"]["TEACH"] = {"code": "TEACH", "role_codes": ["TEACH"]}
    return {"program_code": "P1", "academic_year_code": "Y1", "section_code": "S1", "session_date": DAY,
            "period": 1, "marks": [{"student_code": "ST1", "status": "present"}, {"student_code": "ST2", "status": "absent"}]}


def listing(client, headers, **query):
    return client.get(BASE, headers=headers, params={"program_code": "P1", "academic_year_code": "Y1", "section_code": "S1", "on": DAY, **query})


def test_register_roster_analytics_and_stale_edits(client, headers, attendance_data, app):
    options = client.get(BASE + "/options", headers=headers).json()
    assert len(options["courses"]) == 2
    assert options["can_mark"] is True
    assert len(listing(client, headers).json()["students"]) == 2
    assert listing(client, headers).json()["summaries"]["month"]["percentage"] is None
    saved = client.put(BASE + "/register", headers=headers, json=attendance_data)
    assert saved.status_code == 200, saved.text
    assert saved.json()["revision"] == 1
    assert client.put(BASE + "/register", headers=headers, json=attendance_data).status_code == 409
    body = {**attendance_data, "period": 2, "marks": [{"student_code": "ST1", "status": "excused"}, {"student_code": "ST2", "status": "late"}]}
    assert client.put(BASE + "/register", headers=headers, json=body).status_code == 200
    result = listing(client, headers).json()
    for key in ("day", "week", "month", "year"):
        assert result["summaries"][key]["percentage"] == 50
        assert result["summaries"][key]["recorded"] == 4
        assert result["summaries"][key]["leave_days"] == 1  # approved + excused is one student-day
    assert result["summaries"]["period"]["recorded"] == 2
    assert result["summaries"]["month"]["absent_days"] == 1
    assert result["calendar"][5]["recorded"] == 0  # no phantom absences
    with app.state.store.transaction() as data:
        assert len(data["documents"]["attendance_registers"]) == 2


@pytest.mark.parametrize("invalid", ["cohort", "student", "duplicate", "future", "period", "batch_date"])
def test_invalid_registers_never_save(client, headers, attendance_data, invalid):
    body = {**attendance_data}
    if invalid == "cohort": body["academic_year_code"] = "Y2"
    elif invalid == "student": body["marks"] = [{"student_code": "ST3", "status": "present"}]
    elif invalid == "duplicate": body["marks"] = [body["marks"][0]] * 2
    elif invalid == "future": body["session_date"] = (today() + timedelta(days=1)).isoformat()
    elif invalid == "batch_date": body["session_date"] = "2010-01-01"
    else: body["period"] = 25
    assert client.put(BASE + "/register", headers=headers, json=body).status_code == 422
    assert listing(client, headers).json()["registers"] == []


def test_day_register_cannot_double_count_periods(client, headers, attendance_data):
    assert client.put(BASE + "/register", headers=headers, json=attendance_data).status_code == 200
    assert client.put(BASE + "/register", headers=headers, json={**attendance_data, "period": 0}).status_code == 409
    assert client.put(BASE + "/register", headers=headers, json={**attendance_data, "section_code": None}).status_code == 409


def test_teacher_scope_and_family_privacy(client, headers, attendance_data, app):
    assert client.put(BASE + "/register", headers=headers, json=attendance_data).status_code == 200
    app.dependency_overrides[current_user] = lambda: {"code": "TEACH", "person_type": "employee", "person_code": "EMP1", "client": "teacher-mobile"}
    assert client.get(BASE + "/options").json()["academic_years"][0]["code"] == "Y1"
    assert len(client.get(BASE + "/options").json()["academic_years"]) == 1
    assert client.get(BASE, params={"program_code": "P2", "academic_year_code": "Y2"}).status_code == 403
    assert client.put(BASE + "/register", json={**attendance_data, "section_code": None}).status_code == 403
    app.dependency_overrides[current_user] = lambda: {"code": "PARENT", "person_type": "parent", "person_code": "PAR1"}
    result = client.get(BASE, params={"on": DAY}).json()
    assert [s["code"] for s in result["students"]] == ["ST1"]
    assert set(result["registers"][0]["marks"]) == {"ST1"}
    assert result["can_mark"] is False
    assert client.get(BASE, params={"student_code": "ST2"}).status_code == 404
    assert client.put(BASE + "/register", json=attendance_data).status_code == 403
    app.dependency_overrides.clear()


def test_view_only_and_screen_permissions(client, headers, attendance_data, app):
    with app.state.store.transaction() as data:
        data["roles"]["ROOT"] = {"code": "ROOT", "name": "Reader", "scope": "college", "screens": ["attendance"], "permissions": {"student_attendance": ["view"]}}
    assert listing(client, headers).status_code == 200
    assert client.put(BASE + "/register", headers=headers, json=attendance_data).status_code == 403
    with app.state.store.transaction() as data:
        data["roles"]["ROOT"]["screens"] = ["dashboard"]
    assert listing(client, headers).status_code == 403


def test_legacy_marks_remain_visible(client, headers, attendance_data, app):
    with app.state.store.transaction() as data:
        data["records"]["attendance_sessions"] = {"OLD": {"code": "OLD", "offering_code": "O1", "session_date": DAY, "start_time": "09:00", "end_time": "10:00"}}
        data["records"]["student_attendance"] = {"MARK": {"code": "MARK", "session_code": "OLD", "student_code": "ST1", "status": "present"}}
    assert listing(client, headers).json()["summaries"]["day"]["attended"] == 1
    assert client.put(BASE + "/register", headers=headers, json={**attendance_data, "marks": [{"student_code": "ST2", "status": "late"}]}).status_code == 200
    result = listing(client, headers).json()
    assert result["summaries"]["day"]["attended"] == 2
    assert len(result["registers"]) == 1


def test_legacy_periods_and_whole_day_conflicts(client, headers, attendance_data, app):
    with app.state.store.transaction() as data:
        data["records"]["attendance_sessions"] = {
            f"OLD{n}": {"code": f"OLD{n}", "offering_code": "O1", "session_date": DAY,
                        "start_time": f"{8+n:02}:00", "end_time": f"{9+n:02}:00"} for n in (1, 2)
        }
        data["records"]["student_attendance"] = {
            f"M{n}": {"code": f"M{n}", "session_code": f"OLD{n}", "student_code": "ST1", "status": "present"} for n in (1, 2)
        }
    result = listing(client, headers).json()
    assert [r["period"] for r in result["registers"]] == [1, 2]
    assert result["leave_dates"]["ST1"] == [DAY]
    assert client.put(BASE + "/register", headers=headers, json={**attendance_data, "period": 0}).status_code == 409


def test_edit_requires_permission_and_partial_updates_preserve_marks(client, headers, attendance_data, app):
    assert client.put(BASE + "/register", headers=headers, json=attendance_data).status_code == 200
    edit = {**attendance_data, "revision": 1, "marks": [{"student_code": "ST1", "status": "late"}]}
    result = client.put(BASE + "/register", headers=headers, json=edit)
    assert result.json()["marks"] == {"ST1": "late", "ST2": "absent"}
    with app.state.store.transaction() as data:
        data["roles"]["ROOT"] = {"code": "ROOT", "name": "Entry only", "scope": "college", "screens": ["attendance"], "permissions": {"student_attendance": ["view", "create"]}}
    assert client.put(BASE + "/register", headers=headers, json={**edit, "revision": 2}).status_code == 403


def test_anonymous_and_unlinked_students_cannot_read(client, headers, attendance_data, app):
    assert client.get(BASE + "/options").status_code == 401
    app.dependency_overrides[current_user] = lambda: {"code": "STUDENT", "person_type": "student", "person_code": "ST1"}
    assert client.get(BASE, params={"student_code": "ST2"}).status_code == 404
    assert [s["code"] for s in client.get(BASE, params={"on": DAY}).json()["students"]] == ["ST1"]
    assert client.put(BASE + "/register", json=attendance_data).status_code == 403
    app.dependency_overrides.clear()


def test_existing_batches_without_explicit_year_link_resolve_sections(client, headers, attendance_data, app):
    with app.state.store.transaction() as data:
        data["records"]["academic_years"]["Y1"].pop("batch_code")
        data["records"]["batches"]["B1"].pop("academic_year_code")
    result = client.get(BASE + "/options", headers=headers).json()
    year = next(y for y in result["academic_years"] if y["code"] == "Y1")
    assert year["section_codes"] == ["S1"]
    assert listing(client, headers).status_code == 200


def test_week_summary_includes_adjacent_calendar_year(client, headers, attendance_data):
    for day in ("2019-12-30", "2020-01-01"):
        body = {**attendance_data, "session_date": day, "marks": [{"student_code": "ST1", "status": "present"}]}
        assert client.put(BASE + "/register", headers=headers, json=body).status_code == 200
    result = listing(client, headers, on="2020-01-01").json()
    assert result["summaries"]["week"]["recorded"] == 2
    assert result["summaries"]["year"]["recorded"] == 1
