from tests.test_edit_approvals import PASSWORD, REQUESTS
from tests.test_fee_payments_and_cash import PAY, college, pay  # noqa: F401  (fixture)

PAYER = {"name": "Sai Kumar", "roll_or_reference": "R-12", "admission_number": None, "course_level": "degree",
         "course_branch": "BCA", "academic_year": "2026-2029"}


def manual(client, headers, amount="500"):
    with client.app.state.store.transaction() as d:
        d["records"]["campuses"] = {"C": {"code": "C", "name": "Main"}}
    made = client.post(PAY, headers=headers, json={"payer": PAYER, "fee_head_code": "TUI", "amount": amount, "method": "cash",
                                                   "paid_on": "2026-11-07", "semester": 1})
    assert made.status_code == 201, made.text
    return made.json()


def edit_body(**changes):
    return {"payer": PAYER, "semester": 1, "amount": "500.00", "method": "cash", "transaction_reference": None,
            "transaction_date": None, "paid_on": "2026-11-07", "note": None, **changes}


def test_receipt_numbers_are_short_and_run_in_sequence(client, headers, college):  # noqa: F811
    numbers = [pay(client, headers, fee_head_code="TUI", amount="100").json()["receipt"]["receipt_number"] for _ in range(3)]
    assert numbers == ["RCT-0001", "RCT-0002", "RCT-0003"]


def test_admin_edits_a_manual_payment_directly(client, headers, college, app):  # noqa: F811
    made = manual(client, headers)
    code = made["payment"]["code"]
    changed = client.patch(f"{PAY}/{code}", headers=headers,
                           json=edit_body(amount="750.00", method="upi", transaction_reference="UPI-9",
                                          payer={**PAYER, "name": "Sai Kumar K"}, semester=2))
    assert changed.status_code == 200, changed.text
    row = next(r for r in client.get(f"{PAY}?source=manual", headers=headers).json()["items"] if r["code"] == code)
    assert (row["amount"], row["method"], row["student_name"], row["semester"], row["transaction_date"]) == \
        ("750.00", "upi", "Sai Kumar K", 2, "2026-11-07")
    assert row["receipt_number"] == made["receipt"]["receipt_number"]  # the receipt keeps its number
    # Enrolled students' payments are settled against their fees: not editable here.
    linked = pay(client, headers, fee_head_code="TUI", amount="100").json()["payment"]["code"]
    assert client.patch(f"{PAY}/{linked}", headers=headers, json=edit_body()).status_code == 409
    assert client.patch(f"{PAY}/{code}", headers=headers,
                        json=edit_body(method="bank_transfer")).status_code == 422  # needs a transaction number


def test_other_roles_edit_waits_for_the_admin(client, headers, college, app):  # noqa: F811
    with app.state.store.transaction() as d:
        d["roles"]["ACC"] = {"code": "ACC", "name": "Accountant", "scope": "college",
                             "permissions": {"payments": ["view", "create", "edit"], "receipts": ["view"]}}
        d["accounts"]["acc"] = {**d["accounts"]["ADMIN"], "code": "acc", "login_id": "accountant", "person_code": "ADMIN-EMP",
                                "display_name": "Kiran", "role_codes": ["ACC"]}
    login = client.post("/api/v1/auth/login", json={"login_id": "accountant", "password": PASSWORD, "client": "admin-web"})
    staff = {"Authorization": "Bearer " + login.json()["access_token"]}
    code = manual(client, headers)["payment"]["code"]

    waiting = client.patch(f"{PAY}/{code}", headers=staff, json=edit_body(amount="900.00", payer={**PAYER, "name": "Sai K"}))
    assert waiting.status_code == 202 and waiting.json()["pending_approval"]
    assert app.state.store.snapshot()["records"]["payments"][code]["amount"] == "500.00"  # unchanged until approved
    item = client.get(REQUESTS, headers=headers).json()["items"][0]
    assert item["target_title"] == "Fee payment" and item["target_label"] == "Sai Kumar"
    assert {c["field"]: (c["from"], c["to"]) for c in item["changes"]} == \
        {"amount": ("500.00", "900.00"), "payer.name": ("Sai Kumar", "Sai K")}
    assert client.post(f"{REQUESTS}/{item['code']}/accept", headers=headers, json={}).status_code == 200
    assert app.state.store.snapshot()["records"]["payments"][code]["amount"] == "900.00"

    again = client.patch(f"{PAY}/{code}", headers=staff, json=edit_body(amount="100.00", payer={**PAYER, "name": "Sai K"}))
    assert client.post(f"{REQUESTS}/{again.json()['edit_request_code']}/reject", headers=headers, json={}).status_code == 200
    assert app.state.store.snapshot()["records"]["payments"][code]["amount"] == "900.00"  # rejected: no change
