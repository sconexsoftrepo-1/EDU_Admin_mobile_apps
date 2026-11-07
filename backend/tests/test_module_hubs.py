"""Dashboard navigation contracts, authorization boundaries and real financial calculations."""
import json
from pathlib import Path

from app.core.module_hubs import HUBS

BASE = "/api/v1/dashboard/modules/"


def test_manifest_covers_every_existing_screen_and_matches_frontend():
    root = Path(__file__).parents[2]
    frontend = json.loads((root / "admin-dashboard/src/lib/colleges/module-hubs.json").read_text())
    screens = json.loads((root / "backend/app/contracts/screens.json").read_text())
    assert frontend == HUBS
    grouped = [s for h in HUBS for s in h["screens"]]
    assert len(grouped) == len(set(grouped)), "Each screen must have a single module owner"
    # Merged screens keep their address (they redirect or open inside another screen) but have no card.
    merged = {"receipts", "module-finance"}
    assert {s["key"] for s in screens} - {"dashboard", "campus-analytics", "change-requests"} - merged == set(grouped)


def test_all_module_summaries_are_bounded_and_read_only(app, client, headers):
    before = app.state.store.snapshot()["records"]
    for hub in HUBS:
        response = client.get(BASE + hub["key"], headers=headers)
        assert response.status_code == 200, (hub["key"], response.text)
        body = response.json()
        assert body["key"] == hub["key"]
        assert len(body["recent"]) <= 8 and len(body["pending"]) <= 8
        assert set(body["destinations"]) <= set(hub["screens"])
    assert app.state.store.snapshot()["records"] == before


def test_filters_and_unknown_modules_are_validated(client, headers):
    assert client.get(BASE + "finance?start=2026-12-01&end=2026-01-01", headers=headers).status_code == 422
    assert client.get(BASE + "finance?start=bad", headers=headers).status_code == 422
    assert client.get(BASE + "finance?academic_year=missing", headers=headers).status_code == 422
    assert client.get(BASE + "missing", headers=headers).status_code == 404
    assert client.get(BASE + "finance").status_code == 401


def login_role(app, client, permissions, screens=None):
    with app.state.store.transaction() as data:
        data["roles"]["LIMITED"] = {"code": "LIMITED", "name": "Cashier", "scope": "college", "permissions": permissions, **({"screens": screens} if screens else {})}
        data["accounts"]["LIMITED"] = {**data["accounts"]["ADMIN"], "code": "LIMITED", "login_id": "limited", "role_codes": ["LIMITED"]}
    response = client.post("/api/v1/auth/login", json={"login_id": "limited", "password": "Strong-Test-Password-245!", "client": "admin-web"})
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def test_resource_permissions_and_screen_allowlist_cannot_be_bypassed(app, client):
    with app.state.store.transaction() as data:
        data["records"]["expenses"] = {"PRIVATE": {"code": "PRIVATE", "amount": "999999", "description": "Confidential"}}
    headers = login_role(app, client, {"payments": ["view"]}, ["payments"])
    body = client.get(BASE + "finance", headers=headers).json()
    assert body["destinations"] == ["payments"]
    assert body["cashbook"] is None
    assert [m["label"] for m in body["metrics"]] == ["Total collected"]
    assert "Confidential" not in str(body) and "999999" not in str(body)
    for module in ["administration", "students", "hr", "procurement"]:
        assert client.get(BASE + module, headers=headers).status_code == 403


def test_finance_reuses_balances_separates_overdue_and_excludes_online_cash(app, client, headers):
    from app.core import academic_progress
    today = academic_progress.local_now().date().isoformat()
    with app.state.store.transaction() as data:
        r = data["records"]
        r["academic_years"] = {"Y": {"code": "Y", "name": "2026–27"}}
        r["fee_heads"] = {"H": {"code": "H", "name": "Tuition", "collection_ownership": "internal"}}
        r["fee_structures"] = {"FS": {"code": "FS", "fee_head_code": "H", "academic_year_code": "Y", "currency": "INR"}}
        r["student_fee_charges"] = {
            "C1": {"code": "C1", "fee_structure_code": "FS", "amount": "1000", "due_date": "2020-01-01"},
            "C2": {"code": "C2", "fee_structure_code": "FS", "amount": "500", "due_date": "2999-01-01"},
        }
        r["payments"] = {
            "CASH": {"code": "CASH", "paid_on": today, "amount": "200", "method": "cash", "status": "settled"},
            "ONLINE": {"code": "ONLINE", "paid_on": today, "amount": "100", "method": "upi", "status": "settled"},
            "PENDING": {"code": "PENDING", "paid_on": today, "amount": "500", "method": "cash", "status": "pending"},
        }
        r["payment_allocations"] = {"A": {"code": "A", "charge_code": "C1", "payment_code": "CASH", "amount": "200"}}
        r["refunds"] = {}; r["refund_allocations"] = {}; r["fee_adjustments"] = {}; r["charge_scholarship_allocations"] = {}; r["expense_payment_entries"] = {}
    response = client.get(BASE + "finance", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    values = {m["label"]: float(m["value"]) for m in body["metrics"]}
    assert values["Gross fees"] == 1500 and values["Outstanding fees"] == 1300
    assert values["Overdue fees"] == 800 and values["Total collected"] == 300
    assert body["cashbook"]["receipts"] == 200
    assert body["cashbook"]["closing"] == body["cashbook"]["opening"] + 200
    assert any(p["code"] == "PENDING" for p in body["pending"])
    filtered = client.get(BASE + "finance?academic_year=Y", headers=headers).json()
    assert next(m["value"] for m in filtered["metrics"] if m["label"] == "Total collected") == "200.0"
    assert len(filtered["recent"]) == 1
    assert filtered["years"] == [{"code": "Y", "name": "2026–27"}]
    with app.state.store.transaction() as data:
        data["records"]["refunds"] = {"R": {"code": "R", "payment_code": "CASH", "amount": "10", "refunded_on": today}}
        data["records"]["refund_allocations"] = {"RA": {"code": "RA", "refund_code": "R", "charge_code": "C1", "amount": "10"}}
    filtered = client.get(BASE + "finance?academic_year=Y", headers=headers).json()
    assert float(next(m["value"] for m in filtered["metrics"] if m["label"] == "Total collected")) == 190
    assert filtered["cashbook"]["payments"] == 10


def test_hostel_occupancy_uses_active_allocations(app, client, headers):
    with app.state.store.transaction() as data:
        data["records"]["hostel_beds"] = {k: {"code": k} for k in ["B1", "B2"]}
        data["records"]["hostel_allocations"] = {"A1": {"code": "A1", "bed_code": "B1", "student_code": "S", "start_date": "2020-01-01", "end_date": None}, "A2": {"code": "A2", "bed_code": "B2", "start_date": "2019-01-01", "end_date": "2020-01-01"}}
    body = client.get(BASE + "hostel", headers=headers).json()
    metrics = {m["label"]: m["value"] for m in body["metrics"]}
    assert metrics["Bed occupancy"] == 50 and metrics["Available beds"] == 1


def test_student_year_filter_scopes_enrollments_chart_and_attendance(app, client, headers):
    from app.core.academic_progress import local_now
    today = local_now().date().isoformat()
    with app.state.store.transaction() as d:
        r = d['records']
        r['programs'] = {'P': {'code':'P','name':'BCA'}, 'Q': {'code':'Q','name':'B.Com'}}
        r['academic_years'] = {'Y': {'code':'Y','name':'2026–29','program_code':'P','batch_code':'B'}, 'Z': {'code':'Z','name':'2025–28','program_code':'Q','batch_code':'C'}}
        r['batches'] = {'B': {'code':'B','program_code':'P','academic_year_code':'Y'}, 'C': {'code':'C','program_code':'Q','academic_year_code':'Z'}}
        r['sections'] = {'SEC': {'code':'SEC','batch_code':'B'}, 'OTHER': {'code':'OTHER','batch_code':'C'}}
        r['students'] = {k:{'code':k,'first_name':k,'status':'active','admission_date':today} for k in ['Asha','Ravi','Other']}
        r['student_enrollments'] = {k:{'code':k,'student_code':student,'section_code':section,'status':'active','enrolled_on':today} for k,student,section in [('E1','Asha','SEC'),('E2','Ravi','SEC'),('E3','Other','OTHER')]}
        r['student_leave_requests'] = {'PRIVATE-LEAVE': {'code':'PRIVATE-LEAVE','student_code':'Other','status':'pending'}}
        d.setdefault('documents',{})['attendance_workspace'] = {}  # Registers are seeded below through the actual storage helper.
        from app.core.attendance_workspace import documents
        documents(d)['REGISTER'] = {'code':'REGISTER','academic_year_code':'Y','session_date':today,'period':1,'marks':{'Asha':'present','Ravi':'absent','Other':'present'}}
    body = client.get(BASE+'students?academic_year=Y',headers=headers).json()
    metrics = {m['label']:m for m in body['metrics']}
    assert metrics['Students']['value'] == 2
    assert metrics['Active enrollments']['value'] == 2
    assert metrics['Pending leave requests']['value'] == 0
    assert not any(p['code']=='PRIVATE-LEAVE' for p in body['pending'])
    assert 'Student enrollments' not in metrics
    assert metrics['Student attendance']['value'] == 50
    assert sum(m['label']=='Student attendance' for m in body['metrics']) == 1
    chart = next(c for c in body['charts'] if c['title'].startswith('Students by program'))
    assert chart['items'] == [{'label':'BCA','value':2}]
    assert {i['title'] for i in body['recent']} >= {'Asha','Ravi'}


def test_names_never_bypass_resource_permissions(app, client):
    with app.state.store.transaction() as d:
        d['records']['students'] = {'S': {'code':'S','first_name':'Private','last_name':'Student'}}
        d['records']['payments'] = {'PAY': {'code':'PAY','student_code':'S','status':'pending','amount':'10','method':'cash','paid_on':'2026-11-07'}}
    scoped = login_role(app,client,{'payments':['view']},['payments'])
    body = client.get(BASE+'finance',headers=scoped).json()
    assert 'Private' not in str(body)
    assert body['recent'][0]['title'] == 'PAY'


def test_each_module_enforces_screen_restricted_role_profiles(app, client):
    from app.core.module_hubs import DEFINITIONS
    for hub in HUBS:
        source_screen = next(s for s in hub['screens'] if DEFINITIONS[s]['resources'])
        resource = DEFINITIONS[source_screen]['resources'][0]
        scoped = login_role(app,client,{resource:['view']},[source_screen])
        response = client.get(BASE+hub['key'],headers=scoped)
        assert response.status_code == 200, (hub['key'],response.text)
        assert response.json()['destinations'] == [source_screen]
        for other in HUBS:
            if other['key'] != hub['key']:
                assert client.get(BASE+other['key'],headers=scoped).status_code == 403, (hub['key'],other['key'])
