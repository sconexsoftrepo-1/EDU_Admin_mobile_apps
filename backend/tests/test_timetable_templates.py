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
