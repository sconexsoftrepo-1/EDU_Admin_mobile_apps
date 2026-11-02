from tests.test_lab_workspace import seed
from tests.test_screen_workflows import mobile_login


def test_student_leave_reaches_the_dashboard_and_is_decided(app, client, headers):
    seed(app)
    data = app.state.store.snapshot()
    link = next(iter(data["records"]["student_parents"].values()))
    student = data["records"]["students"][link["student_code"]]
    parent = mobile_login(client, app, "parent", link["parent_code"], "parent-mobile")
    made = client.post("/api/v1/mobile/workspace/leave/actions/request_student_leave", headers=parent,
                       json={"values": {"start_date": "2026-12-01", "end_date": "2026-12-02", "reason": "Family function"},
                             "student_code": student["code"]})
    assert made.status_code == 201, made.text

    listing = client.get("/api/v1/students/leave-workspace", headers=headers).json()
    row = next(r for r in listing["items"] if r["reason"] == "Family function")
    assert row["student_name"] and row["admission_number"] == student["admission_number"]
    assert row["course_name"] and row["days"] == 2 and row["status"] == "pending"
    assert listing["can_decide"] and listing["counts"]["pending"] >= 1

    decided = client.post(f"/api/v1/students/leave-workspace/{row['code']}/decision", headers=headers,
                          json={"status": "approved", "note": "Take care"})
    assert decided.status_code == 200 and decided.json()["status"] == "approved"
    assert client.post(f"/api/v1/students/leave-workspace/{row['code']}/decision", headers=headers,
                       json={"status": "rejected"}).status_code == 409
    notices = client.get("/api/v1/mobile/workspace/notifications", headers=parent).json()["items"]
    assert any(n["title"] == "Leave approved" for n in notices)
    # Parents cannot use the dashboard endpoint.
    assert client.get("/api/v1/students/leave-workspace", headers=parent).status_code == 403


def test_certificate_requests_have_short_references_and_course(app, client, headers):
    seed(app)
    data = app.state.store.snapshot()
    link = next(iter(data["records"]["student_parents"].values()))
    student = data["records"]["students"][link["student_code"]]
    parent = mobile_login(client, app, "parent", link["parent_code"], "parent-mobile")
    made = client.post("/api/v1/certificates/workspace/requests", headers=parent,
                       json={"student_code": student["code"], "template_code": "study_certificate", "reason": "Bank account"})
    assert made.status_code == 201, made.text
    assert made.json()["code"] == f"CREQ-{student['admission_number']}-1"
    row = next(r for r in client.get("/api/v1/certificates/workspace", headers=headers).json()["items"]
               if r["code"] == made.json()["code"])
    assert row["student_name"] and row["reference"] == row["code"]
