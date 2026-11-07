from tests.test_lab_workspace import seed
from tests.test_screen_workflows import mobile_login

ADMISSIONS = "/api/v1/dashboard/admission-analytics"
CAMPUS = "/api/v1/dashboard/campus-analytics"


def seed_enquiries(app):
    with app.state.store.transaction() as d:
        r = d["records"]
        r["programs"] = {**r.get("programs", {}), "P1": {"code": "P1", "name": "BCA", "course_level": "degree"}}
        base = {"first_name": "Asha", "last_name": "Rao", "phone": "9876543210", "program_code": "P1"}
        r["admission_enquiries"] = {
            "E1": {**base, "code": "E1", "status": "closed", "workflow_status": "joined", "reference_type": "staff",
                   "reference_name": "Rohan", "assigned_employee_code": "ADMIN-EMP"},
            "E2": {**base, "code": "E2", "status": "contacted", "reference_type": "social_media", "next_follow_up_at": "2026-01-01T10:00:00+00:00"},
        }
        r["enquiry_followups"] = {"F1": {"code": "F1", "enquiry_code": "E2", "occurred_at": "2025-12-01T10:00:00+00:00", "next_follow_up_at": None}}
        r["admission_applications"] = {"A1": {"code": "A1", "program_code": "P1", "first_name": "Ravi", "last_name": "K", "phone": "9000000000",
                                              "status": "submitted", "enquiry_code": "E2"}}


def test_admission_rows_and_all_eight_references(app, client, headers):
    seed_enquiries(app)
    body = client.get(ADMISSIONS, headers=headers).json()
    keys = [o["key"] for o in body["options"]["references"]]
    assert keys[:8] == ["walk_in", "employee", "staff", "relative", "advertising", "post", "social_media", "other"]
    rows = {r["code"]: r for r in body["enquiries"]}
    assert rows["E1"]["stage"] == "joined" and rows["E1"]["course_level"] == "degree" and rows["E1"]["mine"]
    # An application record links its enquiry, and follow-ups are counted from the real table.
    assert rows["E2"]["stage"] == "application" and rows["E2"]["has_application"] and rows["E2"]["followups_done"] == 1
    assert body["applications"][0]["reference_type"] == "social_media"


def test_personal_details_are_removed_without_permission(app, client):
    seed(app)
    seed_enquiries(app)
    teacher = mobile_login(client, app, "employee", "OTHER-EMP", "teacher-mobile")
    body = client.get(ADMISSIONS, headers=teacher).json()
    assert not body["can_view_all"] and len(body["enquiries"]) == 2
    assert "Asha" not in str(body) and "9876543210" not in str(body) and "Rohan" not in str(body)
    # Totals by category still work without any personal detail.
    assert {r["reference_type"] for r in body["enquiries"]} == {"staff", "social_media"}
    parent = mobile_login(client, app, "parent", "PAR-1", "parent-mobile")
    assert client.get(ADMISSIONS, headers=parent).status_code == 403
    assert client.get(CAMPUS, headers=parent).status_code == 403


def test_collections_cashbook_and_dues_use_real_records(app, client, headers):
    with app.state.store.transaction() as d:
        r = d["records"]
        r["students"] = {"S1": {"code": "S1", "first_name": "Asha", "last_name": "Rao"}}
        r["programs"] = {"P1": {"code": "P1", "name": "BCA", "department_code": "D1"}}
        r["fee_heads"] = {"H1": {"code": "H1", "name": "Tuition fee", "collection_ownership": "internal"}}
        r["fee_structures"] = {"FS": {"code": "FS", "fee_head_code": "H1", "program_code": "P1", "academic_year_code": "Y1", "currency": "INR", "amount": "1000"}}
        r["student_fee_charges"] = {
            "C1": {"code": "C1", "student_code": "S1", "fee_structure_code": "FS", "amount": "1000", "tax_amount": "0", "due_date": "2020-01-01"},
            "C2": {"code": "C2", "student_code": "S1", "fee_structure_code": "FS", "amount": "300", "tax_amount": "0", "due_date": "2999-01-01"},
        }
        r["payments"] = {
            "P": {"code": "P", "student_code": "S1", "amount": "600.00", "status": "settled", "paid_on": "2026-06-10", "method": "cash"},
            "U": {"code": "U", "student_code": "S1", "amount": "50.00", "status": "settled", "paid_on": "2026-06-11", "method": "upi"},
            "X": {"code": "X", "student_code": "S1", "amount": "999.00", "status": "failed", "paid_on": "2026-06-11", "method": "cash"},
        }
        r["payment_allocations"] = {"A": {"code": "A", "payment_code": "P", "charge_code": "C1", "amount": "600.00"}}
        r["expenses"] = {"X1": {"code": "X1", "amount": "70.50", "category": "Stationery", "expense_date": "2026-06-01", "payment_status": "unpaid"}}
    body = client.get(CAMPUS, headers=headers).json()
    assert {(c["purpose"], c["method"], c["amount"]) for c in body["collections"]} == {("Tuition fee", "cash", 600), ("Not allocated to a fee", "upi", 50)}
    assert sum(c["amount"] for c in body["collections"]) == 650
    # Only physical cash is in the cashbook: UPI is excluded.
    assert body["cashbook"]["closing"] == 600 and body["cashbook"]["recent"][0]["receipt"] == 600
    dues = {d["due_date"]: d for d in body["dues"]}
    assert dues["2020-01-01"]["amount"] == 400 and dues["2020-01-01"]["days_overdue"] > 0
    assert dues["2999-01-01"]["amount"] == 300 and dues["2999-01-01"]["days_overdue"] == 0
    assert body["expenses"][0] == {"date": "2026-06-01", "amount": 70.5, "category": "Stationery", "description": None, "status": "unpaid"}


def test_campus_finance_needs_permission(app, client):
    with app.state.store.transaction() as d:
        d["roles"]["VIEW"] = {"code": "VIEW", "name": "Hostel Warden", "scope": "college", "permissions": {"hostel_permissions": ["view"]}}
        d["accounts"]["warden"] = {**d["accounts"]["ADMIN"], "code": "warden", "login_id": "warden", "role_codes": ["VIEW"]}
        d["records"]["hostel_permissions"] = {"H": {"code": "H", "status": "pending"}}
    login = client.post("/api/v1/auth/login", json={"login_id": "warden", "password": "Strong-Test-Password-245!", "client": "admin-web"})
    body = client.get(CAMPUS, headers={"Authorization": "Bearer " + login.json()["access_token"]}).json()
    assert body["collections"] is None and body["dues"] is None and body["cashbook"] is None and body["expenses"] is None
    assert body["operations"]["hostel_permissions"]["value"] == 1
