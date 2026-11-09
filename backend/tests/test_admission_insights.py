from tests.test_screen_workflows import mobile_login

URL = "/api/v1/admissions/insights"


def seed(app):
    with app.state.store.transaction() as d:
        r = d["records"]
        r["programs"] = {"P1": {"code": "P1", "name": "B.Sc", "course_level": "degree", "intake_capacity": 60},
                         "P2": {"code": "P2", "name": "MPC", "course_level": "intermediate", "intake_capacity": 40}}
        r["admission_sources"] = {"WEB": {"code": "WEB", "name": "Website", "channel": "website"}}
        base = {"first_name": "Asha", "last_name": "Rao", "phone": "9876543210"}
        r["admission_enquiries"] = {
            "E1": {**base, "code": "E1", "program_code": "P1", "status": "closed", "workflow_status": "joined",
                   "reference_type": "staff", "reference_name": "Test Administrator", "assigned_employee_code": "ADMIN-EMP"},
            "E2": {**base, "code": "E2", "program_code": "P1", "status": "new", "reference_type": "staff",
                   "assigned_employee_code": "OTHER-EMP"},
            "E3": {**base, "code": "E3", "program_code": "P2", "status": "contacted", "reference_type": "social_media",
                   "reference_name": "Instagram"},
            "E4": {**base, "code": "E4", "program_code": "P2", "status": "applied", "source_code": "WEB"},
        }


def test_analytics_by_reference_and_own_list(app, client, headers):
    seed(app)
    body = client.get(URL, headers=headers).json()
    stats = body["analytics"]
    assert stats["can_view_all"] and stats["all"]["total"] == 4 and stats["all"]["joined"] == 1
    assert stats["all"]["conversion"] == 25
    groups = {g["key"]: g for g in stats["all"]["by_reference"]}
    assert groups["staff"]["total"] == 2 and groups["staff"]["share"] == 50 and groups["staff"]["conversion"] == 50
    # The public form leaves no reference type; the source channel stands in.
    assert groups["website"]["label"] == "Website" and groups["social_media"]["share"] == 25
    assert groups["staff"]["courses"] == [{"name": "B.Sc", "count": 2, "percentage": 100}]
    assert {r["code"] for r in stats["all_rows"]} == {"E1", "E2", "E3", "E4"}
    assert [r["code"] for r in stats["my_rows"]] == ["E1"] and stats["mine"]["total"] == 1


def test_available_uses_open_cycles_or_every_course(app, client, headers):
    seed(app)
    rows = client.get(URL, headers=headers).json()["available"]
    assert [r["course_name"] for r in rows] == ["B.Sc", "MPC"]
    assert rows[0]["intake_capacity"] == 60 and rows[0]["joined"] == 1
    with app.state.store.transaction() as d:
        d["records"]["academic_years"] = {"Y1": {"code": "Y1", "program_code": "P2", "name": "2026-27"}}
        d["records"]["admission_cycles"] = {
            "OPEN": {"code": "OPEN", "name": "Open cycle", "academic_year_code": "Y1", "opens_on": "2020-01-01", "closes_on": "2999-01-01"},
            "PAST": {"code": "PAST", "name": "Past cycle", "academic_year_code": "Y1", "opens_on": "2020-01-01", "closes_on": "2020-06-01"},
        }
    rows = client.get(URL, headers=headers).json()["available"]
    assert [(r["course_name"], r["cycle_name"], r["closes_on"]) for r in rows] == [("MPC", "Open cycle", "2999-01-01")]


def test_people_without_the_permission_get_no_applicant_data(app, client):
    seed(app)
    parent = mobile_login(client, app, "parent", "PAR-1", "parent-mobile")
    body = client.get(URL, headers=parent).json()
    assert body["available"] and body["analytics"] is None
    assert "Asha" not in str(body)

    teacher = mobile_login(client, app, "employee", "OTHER-EMP", "teacher-mobile")
    stats = client.get(URL, headers=teacher).json()["analytics"]
    assert not stats["can_view_all"] and stats["all_rows"] == []
    assert stats["all"]["total"] == 4 and stats["all"]["referrers"] == []
    assert all(g["referrers"] == [] for g in stats["all"]["by_reference"])
    assert [r["code"] for r in stats["my_rows"]] == ["E2"]


def test_intake_records_who_added_the_enquiry(app, client, headers):
    with app.state.store.transaction() as d:
        d["records"]["campuses"] = {"C": {"code": "C"}}
    made = client.post("/api/v1/admissions/admission-enquiries/intake", headers=headers, json={"values": {
        "campus_code": "C", "first_name": "Ravi", "last_name": "K", "phone": "9876543210", "status": "new",
        "communication_consent": False, "reference_type": "relative"}})
    assert made.status_code == 201, made.text
    stats = client.get(URL, headers=headers).json()["analytics"]
    assert [r["name"] for r in stats["my_rows"]] == ["Ravi K"]
    assert stats["my_rows"][0]["recorded_at"]


def test_login_code_identifies_one_sign_in(client):
    login = lambda: client.post("/api/v1/auth/login", json={
        "login_id": "admin", "password": "Strong-Test-Password-245!", "client": "admin-web"}).json()
    first = login()
    code = first["account"]["login_code"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + first["access_token"]}).json()
    assert me["account"]["login_code"] == code
    # A token refresh is the same sign-in, so the admissions popup must not come back.
    renewed = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"], "client": "admin-web"})
    assert renewed.status_code == 200, renewed.text
    again = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + renewed.json()["access_token"]}).json()
    assert again["account"]["login_code"] == code and again["account"]["session_code"] != me["account"]["session_code"]
    assert login()["account"]["login_code"] != code


def test_my_reference_credits_whoever_entered_the_enquiry(app, client, headers):
    with app.state.store.transaction() as d:
        d["records"]["campuses"] = {"C": {"code": "C"}}
        d["records"]["programs"] = {"P2": {"code": "P2", "name": "MPC", "course_level": "intermediate"}}
    made = client.post("/api/v1/admissions/admission-enquiries/intake", headers=headers, json={"values": {
        "campus_code": "C", "program_code": "P2", "first_name": "Ravi", "last_name": "K", "phone": "9876543210",
        "status": "joined", "communication_consent": False, "reference_type": "self"}})
    assert made.status_code == 201, made.text
    body = made.json()
    # The Super Admin entered it: an admin reference credited to them.
    assert body["reference_type"] == "admin" and body["reference_name"] and body["referred_by_account"] == "ADMIN"
    rows = client.get("/api/v1/dashboard/admission-analytics", headers=headers).json()["enquiries"]
    row = next(r for r in rows if r["name"] == "Ravi K")
    assert (row["reference_label"], row["credited_to"], row["status"]) == ("Admin reference", body["reference_name"], "joined")
    # Choosing an outside source keeps it; nobody on staff is credited.
    other = client.post("/api/v1/admissions/admission-enquiries/intake", headers=headers, json={"values": {
        "campus_code": "C", "first_name": "Sita", "last_name": "M", "phone": "9876543211", "status": "new",
        "communication_consent": False, "reference_type": "social_media", "reference_name": "Instagram"}})
    rows = client.get("/api/v1/dashboard/admission-analytics", headers=headers).json()["enquiries"]
    sita = next(r for r in rows if r["name"] == "Sita M")
    assert other.status_code == 201 and sita["reference_type"] == "social_media" and sita["credited_to"] is None
