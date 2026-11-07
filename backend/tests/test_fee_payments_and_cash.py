import base64

import pytest

from app.core.cash_custody import CLERK_ROLE, ensure_clerk_role
from tests.test_screen_workflows import mobile_login

PAY = "/api/v1/finance/fee-payments"
CASH = "/api/v1/finance/cash"
SLIP = base64.b64encode(b"\xff\xd8\xff\xe0 fake jpeg bytes for a bank slip").decode()


@pytest.fixture
def college(app):
    with app.state.store.transaction() as d:
        r = d["records"]
        r["programs"] = {"BCA": {"code": "BCA", "name": "BCA", "course_level": "degree", "branch": "Computer applications"}}
        r["academic_years"] = {"Y": {"code": "Y", "name": "2026-29", "program_code": "BCA", "start_date": "2026-06-01", "end_date": "2029-05-31"}}
        r["students"] = {"S1": {"code": "S1", "first_name": "Asha", "last_name": "Rao", "admission_number": "ADM-1"}}
        r["student_admission_profiles"] = {"P1": {"code": "P1", "student_code": "S1", "program_code": "BCA", "academic_year_code": "Y",
                                                  "course_level": "degree", "reference_number": "26DEGBCA0001"}}
        r["fee_heads"] = {"TUI": {"code": "TUI", "name": "Tuition fee", "collection_ownership": "internal", "category": "academic"}}
        r["fee_structures"] = {"FS": {"code": "FS", "program_code": "BCA", "academic_year_code": "Y", "fee_head_code": "TUI",
                                      "amount": "1000", "currency": "INR", "due_date": "2026-07-01", "semester_number": 1}}
        r["student_fee_charges"] = {"C1": {"code": "C1", "student_code": "S1", "fee_structure_code": "FS", "amount": "1000",
                                           "due_date": "2026-07-01", "tax_amount": "0"}}
        ensure_clerk_role(d)
    return app


def pay(client, headers, **body):
    return client.post(PAY, headers=headers, json={"student_code": "S1", "paid_on": "2026-11-07", "method": "cash", **body})


def test_payment_form_settles_the_chosen_fee_and_issues_a_receipt(client, headers, college):
    found = client.get(f"{PAY}/students?q=26DEG", headers=headers).json()["items"][0]
    assert (found["name"], found["admission_number"], found["reference_number"], found["course_level_label"]) == \
        ("Asha Rao", "ADM-1", "26DEGBCA0001", "Degree")
    options = client.get(f"{PAY}/options?student_code=S1", headers=headers).json()
    assert next(h for h in options["fee_heads"] if h["code"] == "TUI")["outstanding"] == "1000.00"
    assert any(h["code"] == "certificate:tc" for h in options["fee_heads"])

    made = pay(client, headers, fee_head_code="TUI", amount="1200")
    assert made.status_code == 201, made.text
    body = made.json()
    assert body["receipt"]["receipt_number"] and body["allocations"][0]["amount"] == "1000.00" and body["advance"] == "200.00"
    ledger = client.get("/api/v1/finance/students/S1/ledger", headers=headers).json()
    assert ledger["totals"]["outstanding"] == "0.00"
    # Printed on saving: an admin / staff copy and a student copy in one PDF.
    url = f"/api/v1/documents/receipt/{body['receipt']['code']}/view"
    one, two = client.get(url, headers=headers), client.get(f"{url}?copies=2", headers=headers)
    assert one.status_code == two.status_code == 200 and two.content.startswith(b"%PDF")
    pages = lambda pdf: pdf.count(b"/Type /Page\n") or pdf.count(b"/Type /Page ") or pdf.count(b"/Type /Page>")
    assert pages(two.content) == 2 * pages(one.content) > 0


def test_certificate_and_custom_heads_are_created_on_first_use(client, headers, college):
    tc = pay(client, headers, fee_head_code="certificate:tc", amount="300")
    assert tc.status_code == 201 and tc.json()["payment"]["fee_head_name"] == "Transfer certificate (TC) fee"
    again = pay(client, headers, fee_head_code="certificate:tc", amount="300")
    assert again.json()["payment"]["fee_head_code"] == tc.json()["payment"]["fee_head_code"]
    custom = pay(client, headers, custom_fee_head="Sports kit", amount="450")
    assert custom.status_code == 201 and custom.json()["payment"]["fee_head_name"] == "Sports kit"
    heads = client.get(f"{PAY}/options", headers=headers).json()["fee_heads"]
    assert not any(h["code"] == "certificate:tc" for h in heads)


def test_bank_transfer_needs_a_unique_transaction_number(client, headers, college):
    assert pay(client, headers, fee_head_code="TUI", amount="100", method="bank_transfer").status_code == 422
    first = pay(client, headers, fee_head_code="TUI", amount="100", method="bank_transfer", transaction_reference="UTR123")
    assert first.status_code == 201
    assert pay(client, headers, fee_head_code="TUI", amount="100", method="bank_transfer", transaction_reference="UTR123").status_code == 409
    upi = pay(client, headers, fee_head_code="TUI", amount="50", method="upi")
    history = client.get(f"{PAY}?method=upi", headers=headers).json()
    assert upi.status_code == 201 and [r["method"] for r in history["items"]] == ["upi"]
    assert history["items"][0]["receipt_number"] and history["totals_by_method"] == {"upi": "50.00"}


def clerk_login(client, app):
    headers = mobile_login(client, app, "employee", "CLERK-EMP", "teacher-mobile")
    with app.state.store.transaction() as d:
        d["accounts"]["employee"]["role_codes"] = [CLERK_ROLE]
        d["records"].setdefault("employees", {})["CLERK-EMP"] = {"code": "CLERK-EMP", "first_name": "Ravi", "last_name": "Clerk"}
    return headers


def day(rows, when):
    return next(r for r in rows if r["date"] == when)


def test_cash_flow_with_a_short_deposit(client, headers, college, app):
    assert pay(client, headers, fee_head_code="TUI", amount="200000", paid_on="2026-11-06").status_code == 201
    assert pay(client, headers, fee_head_code="TUI", amount="5000", method="upi", paid_on="2026-11-06").status_code == 201
    clerk = clerk_login(client, app)
    start = client.get(f"{CASH}/overview", headers=headers).json()
    # UPI never enters the cash book.
    assert start["cash_in_hand"] == "200000.00" and start["with_admin"] == "200000.00"
    assert [c["name"] for c in start["clerks"]] == ["Ravi Clerk"]

    assert client.post(f"{CASH}/transfers", headers=headers, json={"clerk_account": "employee", "amount": "250000"}).status_code == 409
    assert client.post(f"{CASH}/transfers", headers=clerk, json={"clerk_account": "employee", "amount": "10"}).status_code == 403
    made = client.post(f"{CASH}/transfers", headers=headers, json={"clerk_account": "employee", "amount": "150000"})
    assert made.status_code == 201, made.text
    code = made.json()["code"]
    assert client.get(f"{CASH}/overview", headers=headers).json()["with_admin"] == "50000.00"

    assert client.post(f"{CASH}/transfers/{code}/collect", headers=clerk).json()["status"] == "collected"
    # The clerk deposited only 1 lakh of the 1.5 lakh.
    assert client.post(f"{CASH}/transfers/{code}/deposits", headers=clerk, json={"amount": "160000", "deposited_on": "2026-11-07"}).status_code == 409
    deposited = client.post(f"{CASH}/transfers/{code}/deposits", headers=clerk, json={"amount": "100000", "deposited_on": "2026-11-07"})
    assert deposited.status_code == 201 and deposited.json()["status"] == "deposited"
    deposit = deposited.json()["deposits"][0]["code"]
    notices = [n["title"] for n in client.app.state.store.snapshot()["records"]["notifications"].values() if n.get("cash_transfer_code") == code]
    assert "Amount deposited, not confirmed" in notices

    uploaded = client.post(f"{CASH}/transfers/{code}/deposits/{deposit}/proof", headers=clerk,
                           json={"filename": "slip.jpg", "mime_type": "image/jpeg", "content_base64": SLIP})
    assert uploaded.status_code == 200, uploaded.text
    assert uploaded.json()["status"] == "awaiting_review" and uploaded.json()["deposits"][0]["has_proof"]
    image = client.get(f"{CASH}/transfers/{code}/deposits/{deposit}/proof", headers=headers)
    assert image.status_code == 200 and image.headers["content-type"] == "image/jpeg"

    assert client.post(f"{CASH}/transfers/{code}/deposits/{deposit}/review", headers=headers, json={"decision": "reject"}).status_code == 422
    accepted = client.post(f"{CASH}/transfers/{code}/deposits/{deposit}/review", headers=headers, json={"decision": "accept"})
    assert accepted.json()["status"] == "collected" and accepted.json()["with_clerk"] == "50000.00"

    overview = client.get(f"{CASH}/overview", headers=headers).json()
    # Closing cash 1 lakh: 50k with the admin and 50k still with the clerk.
    assert overview["cash_in_hand"] == "100000.00" and overview["with_clerks"] == "50000.00" and overview["with_admin"] == "50000.00"
    row = day(overview["ledger"], "2026-11-07")
    assert (row["opening"], row["deposited"], row["closing"]) == ("200000.00", "100000.00", "100000.00")
    assert client.get(f"{CASH}/overview", headers=clerk).json()["my_in_hand"] == "50000.00"

    # The clerk deposits the rest later; once accepted the transfer is settled.
    rest = client.post(f"{CASH}/transfers/{code}/deposits", headers=clerk, json={"amount": "50000", "deposited_on": "2026-11-07"}).json()
    second = rest["deposits"][1]["code"]
    client.post(f"{CASH}/transfers/{code}/deposits/{second}/proof", headers=clerk,
                json={"filename": "slip2.jpg", "mime_type": "image/jpeg", "content_base64": SLIP})
    done = client.post(f"{CASH}/transfers/{code}/deposits/{second}/review", headers=headers, json={"decision": "accept"}).json()
    assert done["status"] == "settled"
    final = client.get(f"{CASH}/overview", headers=headers).json()
    assert final["cash_in_hand"] == "50000.00" and final["with_clerks"] == "0.00"


def test_clerks_only_act_on_their_own_cash(client, headers, college, app):
    pay(client, headers, fee_head_code="TUI", amount="1000")
    clerk = clerk_login(client, app)
    code = client.post(f"{CASH}/transfers", headers=headers, json={"clerk_account": "employee", "amount": "500"}).json()["code"]
    other = mobile_login(client, app, "other", "OTHER-EMP", "teacher-mobile")
    with app.state.store.transaction() as d:
        d["accounts"]["other"]["role_codes"] = [CLERK_ROLE]
    assert client.post(f"{CASH}/transfers/{code}/collect", headers=other).status_code == 403
    assert client.post(f"{CASH}/transfers/{code}/collect", headers=clerk).status_code == 200
    returned = client.post(f"{CASH}/transfers/{code}/returns", headers=headers, json={"amount": "500", "returned_on": "2026-11-07"})
    assert returned.json()["status"] == "settled"


def test_fees_for_students_not_enrolled_yet(client, headers, college, app):
    with app.state.store.transaction() as d:
        d["records"]["campuses"] = {"C": {"code": "C", "name": "Main"}}
    payer = {"name": "Sai Kumar", "roll_or_reference": "R-12", "admission_number": None, "course_level": "polytechnic",
             "course_branch": "Diploma ECE", "academic_year": "2026-27"}
    body = {"payer": payer, "fee_head_code": "certificate:tc", "amount": "500", "method": "upi", "paid_on": "2026-11-07"}
    assert client.post(PAY, headers=headers, json=body).status_code == 422  # the semester is required here
    made = client.post(PAY, headers=headers, json={**body, "semester": 3})
    assert made.status_code == 201, made.text
    assert made.json()["student"]["name"] == "Sai Kumar" and made.json()["allocations"] == []
    row = client.get(f"{PAY}?q=Sai", headers=headers).json()["items"][0]
    assert (row["student_name"], row["roll_or_reference"], row["course_level"], row["course_branch"]) == \
        ("Sai Kumar", "R-12", "Polytechnic", "Diploma ECE")
    # The system record never shows up as a student.
    assert client.get(f"{PAY}/students?q=Fee payers", headers=headers).json()["items"] == []
    assert "FEE-PAYERS" not in str(client.get("/api/v1/student-management/students", headers=headers).json())
    pdf = client.get(f"/api/v1/documents/receipt/{made.json()['receipt']['code']}/download", headers=headers)
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
    bad = client.post(PAY, headers=headers, json={"fee_head_code": "TUI", "amount": "5", "method": "cash", "paid_on": "2026-11-07"})
    assert bad.status_code == 422


def test_manual_screen_lists_only_manual_payments_and_collects_students(client, headers, college, app):
    with app.state.store.transaction() as d:
        d["records"]["campuses"] = {"C": {"code": "C", "name": "Main"}}
    payer = {"name": "Sai Kumar", "roll_or_reference": "R-12", "course_level": "degree", "course_branch": "BCA", "academic_year": "2026-27"}
    for amount in ("500", "700"):
        client.post(PAY, headers=headers, json={"payer": payer, "fee_head_code": "TUI", "amount": amount, "method": "cash",
                                                "paid_on": "2026-11-07", "semester": 2})
    pay(client, headers, fee_head_code="TUI", amount="100")
    manual = client.get(f"{PAY}?source=manual", headers=headers).json()["items"]
    linked = client.get(f"{PAY}?source=linked", headers=headers).json()["items"]
    assert {r["student_name"] for r in manual} == {"Sai Kumar"} and len(manual) == 2
    assert {r["student_name"] for r in linked} == {"Asha Rao"}
    people = client.get(f"{PAY}/collected-students", headers=headers).json()["items"]
    assert people == [{"name": "Sai Kumar", "roll_or_reference": "R-12", "admission_number": None, "course_level": "Degree",
                       "course_branch": "BCA", "academic_year": "2026-27", "semester": 2, "payments": 2, "total_paid": "1200.00",
                       "first_paid_on": "2026-11-07", "last_paid_on": "2026-11-07"}]


def test_transfer_date_is_kept_as_proof(client, headers, college):
    made = pay(client, headers, fee_head_code="TUI", amount="100", method="upi", transaction_reference="UPI-9",
               transaction_date="2026-11-01", paid_on="2026-11-07")
    assert made.status_code == 201 and made.json()["payment"]["transaction_date"] == "2026-11-01"
    # Defaults to the payment date; never after it; cash has none.
    upi = pay(client, headers, fee_head_code="TUI", amount="10", method="upi", paid_on="2026-11-07")
    assert upi.json()["payment"]["transaction_date"] == "2026-11-07"
    assert pay(client, headers, fee_head_code="TUI", amount="10", method="upi", transaction_date="2026-11-08",
               paid_on="2026-11-07").status_code == 422
    assert pay(client, headers, fee_head_code="TUI", amount="10", transaction_date="2026-11-01").json()["payment"]["transaction_date"] is None
    row = next(r for r in client.get(f"{PAY}?method=upi", headers=headers).json()["items"] if r["transaction_reference"] == "UPI-9")
    assert row["transaction_date"] == "2026-11-01"
    pdf = client.get(f"/api/v1/documents/receipt/{made.json()['receipt']['code']}/download", headers=headers)
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"


def test_collection_analytics_by_day_semester_and_source(client, headers, college, app):
    with app.state.store.transaction() as d:
        d["records"]["campuses"] = {"C": {"code": "C", "name": "Main"}}
    payer = {"name": "Sai Kumar", "roll_or_reference": "R-12", "course_level": "degree", "course_branch": "BCA",
             "academic_year": "2026-2029"}
    for amount, sem, day in (("500", 1, "2026-11-05"), ("700", 1, "2026-11-07")):
        assert client.post(PAY, headers=headers, json={"payer": payer, "fee_head_code": "TUI", "amount": amount, "method": "cash",
                                                       "paid_on": day, "semester": sem}).status_code == 201
    pay(client, headers, fee_head_code="TUI", amount="300", method="upi", transaction_date="2026-11-06", paid_on="2026-11-07",
        semester=4)
    a = client.get(f"{PAY}/analytics", headers=headers).json()
    assert a["summary"]["amount"] == "1500.00" and a["summary"]["payments"] == 3 and a["summary"]["payers"] == 2
    assert [(d["date"], d["amount"]) for d in a["daily"]] == [("2026-11-05", "500.00"), ("2026-11-06", "300.00"),
                                                              ("2026-11-07", "700.00")]
    assert [(s["label"], s["payers"], s["amount"]) for s in a["by_semester"]] == [("Semester 1", 1, "1200.00"),
                                                                                ("Semester 4", 1, "300.00")]
    assert {m["method"]: m["amount"] for m in a["by_method"]} == {"cash": "1200.00", "upi": "300.00"}
    assert {s["source"]: s["payments"] for s in a["by_source"]} == {"manual": 2, "linked": 1}
    narrowed = client.get(f"{PAY}/analytics?source=manual&start=2026-11-06", headers=headers).json()
    assert narrowed["summary"]["amount"] == "700.00"
