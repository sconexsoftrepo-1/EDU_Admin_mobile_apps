import pytest

from tests.test_screen_workflows import mobile_login

PASSWORD = "Strong-Test-Password-245!"
ENQUIRIES = "/api/v1/admissions/admission-enquiries"
REQUESTS = "/api/v1/edit-requests"


@pytest.fixture
def staff(app, client):
    with app.state.store.transaction() as d:
        d["roles"]["OFFICE"] = {"code": "OFFICE", "name": "Admission Officer", "scope": "college", "permissions": {
            "admission_enquiries": ["view", "create", "edit"], "employees": ["view"]}}
        d["accounts"]["office"] = {**d["accounts"]["ADMIN"], "code": "office", "login_id": "officer", "person_code": "ADMIN-EMP",
                                   "display_name": "Ravi Teja", "role_codes": ["OFFICE"]}
        d["records"]["campuses"] = {"C": {"code": "C", "name": "Main"}}
        d["records"]["admission_sources"] = {"S": {"code": "S", "name": "Walk-in", "channel": "walk_in", "is_active": True}}
        d["records"]["admission_enquiries"] = {"E1": {
            "code": "E1", "campus_code": "C", "source_code": "S", "first_name": "Asha", "last_name": "Rao",
            "phone": "9876543210", "status": "new", "communication_consent": False}}
    login = client.post("/api/v1/auth/login", json={"login_id": "officer", "password": PASSWORD, "client": "admin-web"})
    assert login.status_code == 200, login.text
    return {"Authorization": "Bearer " + login.json()["access_token"]}


def live(app):
    return app.state.store.snapshot()["records"]["admission_enquiries"]["E1"]


def request_edit(client, staff, **values):
    response = client.patch(f"{ENQUIRIES}/E1", headers=staff, json=values)
    assert response.status_code == 202, response.text
    assert response.json()["pending_approval"]
    return response.json()["edit_request_code"]


def test_edit_waits_and_accept_applies_it(app, client, headers, staff):
    code = request_edit(client, staff, phone="9000000001")
    # Nothing changes anywhere until the Super Admin accepts.
    assert live(app)["phone"] == "9876543210"
    assert client.get(f"{ENQUIRIES}/E1", headers=staff).json()["phone"] == "9876543210"

    assert client.get(f"{REQUESTS}/pending-count", headers=headers).json() == {"count": 1, "can_decide": True}
    item = client.get(REQUESTS, headers=headers).json()["items"][0]
    assert item["requester_name"] == "Ravi Teja" and item["requester_role"] == "Admission Officer"
    assert item["requested_at"] and item["target_label"] == "Asha Rao"
    assert item["changes"] == [{"field": "phone", "label": "Phone", "from": "9876543210", "to": "9000000001"}]
    assert "body" not in item

    accepted = client.post(f"{REQUESTS}/{code}/accept", headers=headers, json={})
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "accepted" and live(app)["phone"] == "9000000001"
    # A decision cannot run twice.
    assert client.post(f"{REQUESTS}/{code}/accept", headers=headers, json={}).status_code == 409


def test_reject_leaves_the_data_alone(app, client, headers, staff):
    code = request_edit(client, staff, phone="9000000002")
    rejected = client.post(f"{REQUESTS}/{code}/reject", headers=headers, json={"note": "Wrong number"})
    assert rejected.status_code == 200 and rejected.json()["status"] == "rejected"
    assert live(app)["phone"] == "9876543210"
    mine = client.get(REQUESTS, headers=staff).json()
    assert not mine["can_decide"] and mine["items"][0]["decision_note"] == "Wrong number"


def test_only_the_super_admin_decides_and_deletes(app, client, headers, staff):
    code = request_edit(client, staff, phone="9000000003")
    assert client.post(f"{REQUESTS}/{code}/accept", headers=staff, json={}).status_code == 403
    assert client.post(f"{REQUESTS}/{code}/reject", headers=staff, json={}).status_code == 403
    assert client.delete(f"{ENQUIRIES}/E1", headers=staff).status_code == 403
    assert "E1" in app.state.store.snapshot()["records"]["admission_enquiries"]


def test_super_admin_edits_apply_straight_away(app, client, headers, staff):
    assert client.patch(f"{ENQUIRIES}/E1", headers=headers, json={"phone": "9000000004"}).status_code == 200
    assert live(app)["phone"] == "9000000004"
    assert client.get(REQUESTS, headers=headers).json()["items"] == []


def test_no_role_can_queue_what_it_cannot_edit(app, client, staff):
    # The role may only view employees: an accepted request would otherwise run with admin rights.
    denied = client.patch("/api/v1/human-resources/employees/ADMIN-EMP", headers=staff, json={"first_name": "Hacked"})
    assert denied.status_code == 403
    assert client.put("/api/v1/administration/roles/OFFICE", headers=staff, json={"name": "Admin"}).status_code == 403
    assert client.get(REQUESTS, headers=staff).json()["items"] == []


def test_creating_data_needs_no_approval(app, client, staff):
    made = client.post(f"{ENQUIRIES}/intake", headers=staff, json={"values": {
        "campus_code": "C", "first_name": "New", "last_name": "Person", "phone": "9876500000", "status": "new",
        "communication_consent": False}})
    assert made.status_code == 201, made.text


def test_newer_change_is_flagged_before_overwriting(app, client, headers, staff):
    code = request_edit(client, staff, phone="9000000005")
    assert client.patch(f"{ENQUIRIES}/E1", headers=headers, json={"phone": "9111111111"}).status_code == 200
    assert client.get(REQUESTS, headers=headers).json()["items"][0]["stale_fields"] == ["Phone"]
    assert client.post(f"{REQUESTS}/{code}/accept", headers=headers, json={}).status_code == 409
    assert live(app)["phone"] == "9111111111"
    forced = client.post(f"{REQUESTS}/{code}/accept", headers=headers, json={"apply_over_newer_data": True})
    assert forced.status_code == 200 and live(app)["phone"] == "9000000005"


def test_failed_apply_keeps_the_request_waiting(app, client, headers, staff):
    code = request_edit(client, staff, status="not_a_real_status")
    failed = client.post(f"{REQUESTS}/{code}/accept", headers=headers, json={})
    assert failed.status_code == 409
    item = client.get(REQUESTS, headers=headers).json()["items"][0]
    assert item["status"] == "pending" and item["last_error"] and live(app)["status"] == "new"


def test_second_edit_replaces_the_waiting_one(app, client, headers, staff):
    first = request_edit(client, staff, phone="9000000006")
    second = request_edit(client, staff, phone="9000000007")
    assert first == second
    items = client.get(REQUESTS, headers=headers).json()["items"]
    assert len(items) == 1 and items[0]["changes"][0]["to"] == "9000000007"


def test_unchanged_save_creates_no_request(app, client, headers, staff):
    response = client.patch(f"{ENQUIRIES}/E1", headers=staff, json={"phone": "9876543210"})
    assert response.status_code == 200 and response.json()["unchanged"]
    assert client.get(REQUESTS, headers=headers).json()["items"] == []


def test_mobile_clients_are_not_gated(app, client, staff):
    teacher = mobile_login(client, app, "employee", "ADMIN-EMP", "teacher-mobile")
    # Reaches the endpoint's own rules (no permission here), not the approval queue.
    response = client.patch(f"{ENQUIRIES}/E1", headers=teacher, json={"phone": "9000000008"})
    assert response.status_code in {401, 403} and "pending_approval" not in response.text
