"""Regression coverage for the reported admin forms and bootstrap workflows."""
import pytest


@pytest.fixture
def setup_records(seeded):
    with seeded.state.store.transaction() as data:
        data["records"].update({
            "campuses": {"CAMPUS": {"code": "CAMPUS", "name": "Main campus"}},
            "academic_years": {"YEAR": {"code": "YEAR", "name": "2026–2027"}},
        })
    return seeded


def create(client, headers, table, values):
    return client.post(f"/api/v1/workspace/resources/{table}", headers=headers, json={"values": values})


def test_create_bus_route_trip_and_attendance(client, headers, setup_records):
    bus = create(client, headers, "vehicles", {
        "campus_code": "CAMPUS", "registration_number": "ap01ab1234", "capacity": 30,
    })
    assert bus.status_code == 201, bus.text
    vehicle_code = bus.json()["code"]
    assert bus.json()["registration_number"] == "AP01AB1234"
    assert {"value": vehicle_code, "label": "AP01AB1234"} in client.get(
        "/api/v1/workspace/lookups/vehicles", headers=headers).json()
    route = create(client, headers, "transport_routes", {
        "campus_code": "CAMPUS", "name": "City route", "vehicle_code": vehicle_code,
    })
    assert route.status_code == 201, route.text
    trip = create(client, headers, "vehicle_trips", {
        "route_code": route.json()["code"], "trip_date": "2026-10-29", "driver_employee_code": "E1",
    })
    assert trip.status_code == 201, trip.text
    assert trip.json()["status"] == "scheduled"
    trips = client.get("/api/v1/workspace/lookups/vehicle_trips", headers=headers).json()
    assert any(o["value"] == trip.json()["code"] and "2026-10-29" in o["label"] for o in trips)
    assert any(o["value"] == "S1" for o in client.get("/api/v1/workspace/lookups/students", headers=headers).json())
    attendance = {"trip_code": trip.json()["code"], "student_code": "S1", "status": "present"}
    saved = create(client, headers, "transport_attendance", attendance)
    assert saved.status_code == 201, saved.text
    invalid = create(client, headers, "transport_attendance", {**attendance, "employee_code": "E1"})
    assert invalid.status_code == 422
    assert "exactly one passenger" in invalid.json()["detail"]
    assert create(client, headers, "vehicles", {
        "campus_code": "CAMPUS", "registration_number": "ZERO", "capacity": 0,
    }).status_code == 422


def test_expense_status_defaults_and_paid_date_validation(client, headers, setup_records):
    values = {"campus_code": "CAMPUS", "category": "Utilities", "description": "Electricity",
              "amount": "100.00", "expense_date": "2026-10-29"}
    response = create(client, headers, "expenses", values)
    assert response.status_code == 201, response.text
    assert response.json()["payment_status"] == "unpaid"
    assert response.json()["currency"] == "INR"
    assert create(client, headers, "expenses", {**values, "payment_status": "Paid"}).status_code == 422
    invalid = create(client, headers, "expenses", {**values, "payment_status": "paid"})
    assert invalid.status_code == 422
    assert "Paid on" in invalid.json()["detail"]
    assert create(client, headers, "expenses", {
        **values, "payment_status": "paid", "paid_on": "2026-10-29",
    }).status_code == 201


def test_scholarship_defaults_and_percentage_rules(client, headers, setup_records):
    values = {"name": "Merit", "academic_year_code": "YEAR", "maximum_amount": "500.00"}
    response = create(client, headers, "scholarships", values)
    assert response.status_code == 201, response.text
    assert response.json()["eligibility_rules"] == {}
    assert response.json()["award_method"] == "fixed_amount"
    assert create(client, headers, "scholarships", {**values, "eligibility_rules": "some text"}).status_code == 422
    assert create(client, headers, "scholarships", {**values, "award_method": "percentage"}).status_code == 422
    assert create(client, headers, "scholarships", {
        **values, "award_method": "percentage", "award_percent": "50",
    }).status_code == 201
    descriptor = client.get("/api/v1/workspace/resources/scholarships/form", headers=headers).json()
    assert descriptor["defaults"]["eligibility_rules"] == {}
    assert "create" in descriptor["resource"]["actions"]


def test_notification_template_and_admission_source_creation(client, headers, setup_records):
    template = create(client, headers, "notification_templates", {
        "name": "Fee reminder", "channel": "sms", "body": "Please pay your fees.\nThank you.",
    })
    assert template.status_code == 201, template.text
    assert template.json()["is_active"] is True
    source = create(client, headers, "admission_sources", {"name": "Walk in", "channel": "walk_in"})
    assert source.status_code == 201, source.text
    options = client.get("/api/v1/workspace/lookups/admission_sources", headers=headers).json()
    assert {"value": source.json()["code"], "label": "Walk in"} in options
    enquiry = create(client, headers, "admission_enquiries", {
        "campus_code": "CAMPUS", "source_code": source.json()["code"], "first_name": "New",
        "last_name": "Applicant", "phone": "+919876543210",
    })
    assert enquiry.status_code == 201, enquiry.text


def system_admin(app):
    with app.state.store.transaction() as data:
        data["accounts"]["ADMIN"].update(person_type="system", person_code=None)
        data["records"].setdefault("certificate_requests", {})["REQ"] = {"code": "REQ", "status": "pending"}
        data["records"].setdefault("payroll_runs", {})["RUN"] = {"code": "RUN", "status": "calculated"}


def test_unlinked_admin_can_reject_certificate_and_publish_payroll(client, headers, setup_records):
    system_admin(setup_records)
    for action, values in [
        ("certificate-reject", {"code": "REQ", "reason": "Incomplete request"}),
        ("payroll-publish", {"code": "RUN"}),
    ]:
        response = client.post(f"/api/v1/workflows/{action}", headers=headers, json={"values": values})
        assert response.status_code == 200, response.text
    data = setup_records.state.store.snapshot()
    assert data["accounts"]["ADMIN"]["person_type"] == "system"
    assert data["records"]["certificate_requests"]["REQ"]["status"] == "rejected"
    assert data["records"]["payroll_runs"]["RUN"]["status"] == "published"
    assert all(row["actor"] == "ADMIN" for row in data["audit"])


def test_scholarship_approval_links_selected_employee_and_keeps_current_session(client, headers, setup_records):
    system_admin(setup_records)
    actions = client.get("/api/v1/workflows", headers=headers).json()["actions"]
    scholarship = next(a for a in actions if a["key"] == "scholarship-approve")
    assert any(f.get("reference") == "employees" for f in scholarship["fields"])
    values = {"student_scholarship_code": "AW", "charge_code": "C1", "amount": "200.00"}
    missing = client.post("/api/v1/workflows/scholarship-approve", headers=headers, json={"values": values})
    assert missing.status_code == 422
    failed = client.post("/api/v1/workflows/scholarship-approve", headers=headers,
                         json={"values": {**values, "administrator_employee_code": "MISSING"}})
    assert failed.status_code == 422
    assert setup_records.state.store.snapshot()["accounts"]["ADMIN"]["person_type"] == "system"
    response = client.post("/api/v1/workflows/scholarship-approve", headers=headers,
                           json={"values": {**values, "administrator_employee_code": "ADMIN-EMP"}})
    assert response.status_code == 200, response.text
    data = setup_records.state.store.snapshot()
    assert data["accounts"]["ADMIN"]["person_type"] == "employee"
    assert next(iter(data["records"]["charge_scholarship_allocations"].values()))["allocated_by_employee_code"] == "ADMIN-EMP"
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200


def test_roles_tolerate_retained_unlinked_accounts(client, headers, app):
    with app.state.store.transaction() as data:
        data["accounts"]["OLD"] = {"code": "OLD", "login_id": "retained", "role_codes": ["ROOT"], "active": False}
    response = client.get("/api/v1/administration/roles", headers=headers)
    assert response.status_code == 200, response.text
    old = next(a for a in response.json()[0]["assigned_accounts"] if a["code"] == "OLD")
    assert old["employee"] is None
    assert "password_hash" not in old


def test_link_cannot_claim_another_users_employee_and_rolls_back(client, headers, setup_records):
    system_admin(setup_records)
    with setup_records.state.store.transaction() as data:
        data["accounts"]["TAKEN"] = {
            "code": "TAKEN", "login_id": "taken", "person_type": "employee", "person_code": "E1",
            "role_codes": [], "active": False,
        }
    response = client.post("/api/v1/workflows/scholarship-approve", headers=headers, json={"values": {
        "student_scholarship_code": "AW", "charge_code": "C1", "amount": "200.00", "administrator_employee_code": "E1",
    }})
    assert response.status_code == 409
    data = setup_records.state.store.snapshot()
    assert data["accounts"]["ADMIN"]["person_type"] == "system"
    assert data["records"]["student_scholarships"]["AW"]["status"] == "pending"
    assert not data["records"].get("charge_scholarship_allocations")


def test_sql_account_without_person_columns_decodes_as_unlinked_system_account():
    from types import SimpleNamespace
    from app.core.sql_store import Accounts

    columns = {key: None for key in ("code", "login_id", "password_hash", "is_active", "allowed_clients")}
    accounts = Accounts(SimpleNamespace(table=lambda _: SimpleNamespace(t=SimpleNamespace(columns=columns))))
    accounts.roles_of = lambda _: []
    result = accounts.decode({"code": "UNLINKED", "login_id": "unlinked", "password_hash": "hash", "is_active": False})
    assert result["person_type"] == "system"
    assert result["person_code"] is None
    assert result["role_codes"] == []
    assert result["active"] is False


def test_transport_writer_can_load_reference_choices_without_full_directory_access(client, headers, setup_records):
    with setup_records.state.store.transaction() as data:
        data["roles"]["ROOT"].update(system_admin=False, permissions={
            "vehicles": ["view", "create"],
            "vehicle_trips": ["view", "create"],
            "transport_attendance": ["view", "create"],
        })
        data["records"]["transport_routes"] = {"ROUTE": {"code": "ROUTE", "name": "City route"}}
        data["records"]["employees"]["E1"]["private_detail"] = "must not be exposed"
    for table, code in [("campuses", "CAMPUS"), ("employees", "E1"), ("students", "S1"), ("transport_routes", "ROUTE")]:
        response = client.get(f"/api/v1/workspace/lookups/{table}", headers=headers)
        assert response.status_code == 200, response.text
        assert any(option["value"] == code for option in response.json())
        assert all(set(option) == {"value", "label"} for option in response.json())
    assert client.get("/api/v1/workspace/lookups/vendors", headers=headers).status_code == 403
    assert client.get("/api/v1/workspace/lookups/users", headers=headers).status_code == 403
    assert client.get("/api/v1/human-resources/employees", headers=headers).status_code == 403
    with setup_records.state.store.transaction() as data:
        data["roles"]["ROOT"]["permissions"] = {"transport_attendance": ["view"]}
    assert client.get("/api/v1/workspace/lookups/students", headers=headers).status_code == 403
