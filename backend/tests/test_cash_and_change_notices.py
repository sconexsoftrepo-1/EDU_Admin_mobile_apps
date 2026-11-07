from tests.test_edit_approvals import ENQUIRIES, REQUESTS, staff  # noqa: F401  (fixture)
from tests.test_fee_payments_and_cash import CASH, SLIP, clerk_login, college, pay  # noqa: F401  (fixture)


def notices(app, user):
    rows = app.state.store.snapshot()["records"].get("notifications", {}).values()
    return [n for n in rows if n["user_code"] == user]


def test_every_cash_step_notifies_the_other_side_and_opens_the_cash_screen(client, headers, college, app):  # noqa: F811
    pay(client, headers, fee_head_code="TUI", amount="5000")
    clerk = clerk_login(client, app)
    code = client.post(f"{CASH}/transfers", headers=headers, json={"clerk_account": "employee", "amount": "3000"}).json()["code"]
    assert [n["title"] for n in notices(app, "employee")] == ["Cash to deposit"]
    client.post(f"{CASH}/transfers/{code}/collect", headers=clerk)
    deposit = client.post(f"{CASH}/transfers/{code}/deposits", headers=clerk,
                          json={"amount": "3000", "deposited_on": "2026-11-07"}).json()["deposits"][0]["code"]
    client.post(f"{CASH}/transfers/{code}/deposits/{deposit}/proof", headers=clerk,
                json={"filename": "slip.jpg", "mime_type": "image/jpeg", "content_base64": SLIP})
    assert {"Cash collected by clerk", "Amount deposited, not confirmed", "Deposit slip to review"} <= \
        {n["title"] for n in notices(app, "ADMIN")}
    client.post(f"{CASH}/transfers/{code}/deposits/{deposit}/review", headers=headers, json={"decision": "accept"})
    assert "Deposit accepted" in [n["title"] for n in notices(app, "employee")]
    assert all(n["screen"] == "cash" for n in notices(app, "employee"))


def test_change_requests_notify_the_admin_and_then_the_requester(client, headers, staff, app):  # noqa: F811
    waiting = client.patch(f"{ENQUIRIES}/E1", headers=staff, json={"phone": "9000000009"})
    assert waiting.status_code == 202
    to_admin = notices(app, "ADMIN")
    assert to_admin[-1]["title"] == "Change request to review" and to_admin[-1]["screen"] == "change-requests"
    assert client.post(f"{REQUESTS}/{waiting.json()['edit_request_code']}/reject", headers=headers,
                       json={"note": "Wrong number"}).status_code == 200
    told = notices(app, "office")[-1]
    assert told["title"] == "Your change was rejected" and "Wrong number" in told["body"]


def test_admin_app_lists_cash_analytics_and_change_requests(client, headers, app):
    from tests.test_screen_workflows import mobile_login
    admin = mobile_login(client, app, "boss", "ADMIN-EMP", "admin-mobile")
    with app.state.store.transaction() as d:
        d["accounts"]["boss"]["role_codes"] = list(d["accounts"]["ADMIN"]["role_codes"])
    keys = [s["key"] for s in client.get("/api/v1/mobile/workspace/screens", headers=admin).json()["screens"]]
    assert {"cash", "cash-analytics", "change-requests"} <= set(keys)
    summary = client.get("/api/v1/mobile/workspace/cash", headers=admin).json()["summary"]
    assert set(summary) == {"with_admin", "with_clerks", "to_review"}
