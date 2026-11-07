from tests.test_admission_insights import seed as seed_admissions
from tests.test_lab_workspace import seed
from tests.test_screen_workflows import mobile_login

URL = "/api/v1/dashboard/overview"


def test_real_figures_for_a_system_admin(app, client, headers):
    seed(app)
    with app.state.store.transaction() as d:
        d["records"]["admission_enquiries"] = {
            "E1": {"code": "E1", "first_name": "A", "last_name": "B", "status": "closed", "workflow_status": "joined"},
            "E2": {"code": "E2", "first_name": "C", "last_name": "D", "status": "contacted"},
            "E3": {"code": "E3", "first_name": "E", "last_name": "F", "status": "new"},
            "E4": {"code": "E4", "first_name": "G", "last_name": "H", "status": "not_interested"},
        }
        students = len(d["records"].get("students", {}))
        d["records"]["payments"] = {
            "P1": {"code": "P1", "student_code": "X", "amount": "1000.00", "status": "settled", "paid_on": "2026-06-10", "method": "cash"},
            "P2": {"code": "P2", "student_code": "X", "amount": "500.00", "status": "pending", "paid_on": "2026-06-11", "method": "cash"},
        }
        d["records"]["refunds"] = {"R1": {"code": "R1", "payment_code": "P1", "amount": "100.00", "refunded_on": "2026-07-01"}}
    response = client.get(URL, headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["viewer"]["name"] == "Test Administrator" and body["viewer"]["roles"] == ["System Admin"]
    sections = body["sections"]
    assert not any(s.get("error") for s in sections.values()), sections
    assert sections["students"]["metrics"]["students"]["value"] == students

    finance = sections["finance"]
    # Pending payments do not count; refunds reduce the total and their own month.
    assert float(finance["metrics"]["fee_collection"]["value"]) == 900
    months = {m["month"]: m["collected"] for m in finance["monthly"]}
    assert months["2026-06"] == 1000 and months["2026-07"] == -100

    funnel = {s["name"]: s["count"] for s in sections["admissions"]["funnel"]}
    assert funnel == {"Enquiries": 4, "Contacted": 2, "Counselling": 1, "Applied": 1, "Joined": 1}
    assert sections["admissions"]["metrics"]["conversion"]["value"] == 25


def test_sections_follow_permissions(app, client):
    seed(app)
    seed_admissions(app)
    with app.state.store.transaction() as d:
        d["roles"]["CASH"] = {"code": "CASH", "name": "Accounts Manager", "scope": "college", "permissions": {"payments": ["view"]}}
        d["accounts"]["cash"] = {**d["accounts"]["ADMIN"], "code": "cash", "login_id": "cashier", "role_codes": ["CASH"]}
    login = client.post("/api/v1/auth/login", json={"login_id": "cashier", "password": "Strong-Test-Password-245!", "client": "admin-web"})
    assert login.status_code == 200, login.text
    sections = client.get(URL, headers={"Authorization": "Bearer " + login.json()["access_token"]}).json()["sections"]
    assert "finance" in sections
    assert not {"admissions", "students", "people"} & set(sections)
    assert "Asha" not in str(sections)


def test_failed_section_is_reported_not_zero(app, client, headers, monkeypatch):
    from app.core import dashboard_overview as dash

    def broken(*_):
        raise RuntimeError("ledger down")

    monkeypatch.setattr(dash, "finance_section", broken)
    sections = client.get(URL, headers=headers).json()["sections"]
    assert sections["finance"] == {"error": True}
    assert "error" not in sections["students"]


def test_students_and_parents_are_refused(app, client):
    seed(app)
    parent = mobile_login(client, app, "parent", "PAR-1", "parent-mobile")
    assert client.get(URL, headers=parent).status_code == 403
