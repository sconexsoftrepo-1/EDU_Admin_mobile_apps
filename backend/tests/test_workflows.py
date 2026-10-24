from app.core.security import hasher


def payment(client, headers, amount="400.00", key="payment-key-123456789"):
    return client.post(
        "/api/v1/finance/collect",
        headers={**headers, "Idempotency-Key": key},
        json={
            "student_code": "S1",
            "currency": "INR",
            "method": "cash",
            "paid_on": "2026-10-22",
            "transaction_reference": "COUNTER-1",
            "allocations": {"C1": amount},
        },
    )


def test_finance_collection_idempotency_balance(client, headers, seeded):
    a = payment(client, headers)
    assert a.status_code == 201, a.text
    b = payment(client, headers)
    assert b.json()["payment"]["code"] == a.json()["payment"]["code"]
    assert payment(client, headers, "300.00").status_code == 409
    ledger = client.get("/api/v1/finance/students/S1/ledger", headers=headers).json()
    assert (
        ledger["totals"]["paid"] == "400.00"
        and ledger["totals"]["outstanding"] == "600.00"
    )
    assert (
        payment(client, headers, "700.00", "another-key-123456789").status_code == 409
    )
    assert len(seeded.state.store.snapshot()["records"]["payments"]) == 1


def test_adjustments_scholarships_and_reports(client, headers, seeded):
    r = client.post(
        "/api/v1/finance/adjustments",
        headers=headers,
        json={
            "charge_code": "C1",
            "adjustment_type": "discount",
            "amount": "100.00",
            "reason": "Management approved",
        },
    )
    assert r.status_code == 201, r.text
    r = client.post(
        "/api/v1/finance/scholarships/approve",
        headers=headers,
        json={"student_scholarship_code": "AW", "allocations": {"C1": "200.00"}},
    )
    assert r.status_code == 200, r.text
    assert payment(client, headers, "400.00").status_code == 201
    totals = client.get("/api/v1/finance/summary", headers=headers).json()
    assert (
        totals["discount"] == "100.00"
        and totals["scholarship"] == "200.00"
        and totals["outstanding"] == "300.00"
    )
    export = client.get("/api/v1/finance/ledger-export.csv", headers=headers)
    assert export.status_code == 200 and "Outstanding INR" in export.text


def test_reject_wrong_student_negative_precision(client, headers, seeded):
    assert payment(client, headers, "-1.00").status_code == 422
    assert payment(client, headers, "1.001").status_code == 422
    with seeded.state.store.transaction() as d:
        d["records"]["student_fee_charges"]["C1"]["student_code"] = "S2"
    assert payment(client, headers).status_code == 422


def test_mobile_student_isolation(client, seeded):
    with seeded.state.store.transaction() as d:
        d["accounts"]["STUDENT"] = {
            "code": "STUDENT",
            "login_id": "student",
            "password_hash": hasher.hash("Student-Password-123!"),
            "active": True,
            "person_type": "student",
            "person_code": "S1",
            "role_codes": [],
            "clients": ["student-mobile"],
        }
    r = client.post(
        "/api/v1/auth/login",
        json={
            "login_id": "student",
            "password": "Student-Password-123!",
            "client": "student-mobile",
        },
    )
    h = {"Authorization": "Bearer " + r.json()["access_token"]}
    assert client.get("/api/v1/mobile/students/S1/fees", headers=h).status_code == 200
    assert client.get("/api/v1/mobile/students/S2/fees", headers=h).status_code == 404
    assert (
        client.get("/api/v1/student-management/students", headers=h).status_code == 403
    )
    assert client.get("/api/v1/mobile/teacher/payslips", headers=h).status_code == 403


def test_forms_validation_revision_and_history(client, headers):
    body = {
        "name": "Student Intake",
        "screen": "students",
        "published": True,
        "fields": [
            {"key": "student_name", "label": "Student Name", "required": True},
            {
                "key": "course",
                "label": "Course",
                "type": "select",
                "options": ["BSc", "BCom"],
                "required": True,
            },
        ],
    }
    r = client.post("/api/v1/forms", headers=headers, json=body)
    assert r.status_code == 201, r.text
    code = r.json()["code"]
    path = "/api/v1/forms/" + code
    assert (
        client.post(
            path + "/submissions",
            headers=headers,
            json={"revision": 1, "values": {"student_name": "Jane", "course": "Other"}},
        ).status_code
        == 422
    )
    r = client.post(
        path + "/submissions",
        headers=headers,
        json={"revision": 1, "values": {"student_name": "Jane", "course": "BSc"}},
    )
    assert r.status_code == 201, r.text
    assert (
        client.put(path, headers=headers, json={**body, "name": "New Intake"}).json()[
            "revision"
        ]
        == 2
    )
    assert (
        client.post(
            path + "/submissions",
            headers=headers,
            json={"revision": 1, "values": {"student_name": "Jane", "course": "BSc"}},
        ).status_code
        == 409
    )
    assert (
        client.get(path + "/submissions", headers=headers).json()["items"][0][
            "definition"
        ]["name"]
        == "Student Intake"
    )
    assert client.delete(path, headers=headers).status_code == 409


def test_record_validation_reference_and_queries(client, headers):
    p = "/api/v1/academics/institutions"
    r = client.post(
        p,
        headers=headers,
        json={"code": "INST", "name": "Dummy College", "country": "India"},
    )
    assert r.status_code == 201, r.text
    assert client.get(p + "/INST", headers=headers).json()["name"] == "Dummy College"
    assert (
        client.patch(
            p + "/INST", headers=headers, json={"name": "Revised College"}
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/academics/campuses",
            headers=headers,
            json={"institution_code": "MISSING", "name": "North"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            p, headers=headers, json={"name": "Test", "unknown": "x"}
        ).status_code
        == 422
    )
    assert client.delete(p + "/INST", headers=headers).status_code == 204


def test_hostel_approval_departure_return(client, headers, app):
    with app.state.store.transaction() as d:
        d["records"]["hostel_permissions"] = {
            "H1": {"code": "H1", "student_code": "S1", "status": "requested"}
        }
    path = "/api/v1/hostel/permissions/H1"
    assert client.post(path + "/depart", headers=headers).status_code == 409
    assert (
        client.post(
            path + "/approve",
            headers=headers,
            json={
                "pickup_person_name": "Parent One",
                "pickup_relationship": "Father",
                "pickup_contact": "9876543210",
            },
        ).status_code
        == 200
    )
    assert client.post(path + "/depart", headers=headers).status_code == 200
    assert client.post(path + "/return", headers=headers).status_code == 200
    assert client.post(path + "/return", headers=headers).status_code == 409


def test_unconfigured_integrations_do_not_fake_success(client, headers):
    for path in ["sms/send", "payments/order", "certificates/sign"]:
        assert (
            client.post("/api/v1/integrations/" + path, headers=headers).status_code
            == 503
        )


def test_oversized_request_and_security_headers(client):
    assert client.post("/api/v1/auth/login", content="x" * 1_048_577).status_code == 413
    assert client.get("/health").headers["cache-control"] == "no-store"
