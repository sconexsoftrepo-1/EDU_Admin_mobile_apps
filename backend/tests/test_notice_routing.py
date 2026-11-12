"""Notices for payments, announcements and attendance, and clearing read notices."""

from app.core.announcement_notices import announcement_notices
from app.core.attendance_workspace import absence_notices
from app.core.fee_collection import payment_notices


def campus():
    return {
        "accounts": {
            "stu": {"code": "stu", "active": True, "person_type": "student", "person_code": "S1"},
            "par": {"code": "par", "active": True, "person_type": "parent", "person_code": "P1"},
            "tea": {"code": "tea", "active": True, "person_type": "employee", "person_code": "E1"},
            "far": {"code": "far", "active": True, "person_type": "student", "person_code": "S2"},
        },
        "records": {
            "students": {"S1": {"code": "S1", "campus_code": "C1", "first_name": "Asha", "last_name": "Rao"},
                         "S2": {"code": "S2", "campus_code": "C2"}},
            "student_parents": {"L1": {"code": "L1", "student_code": "S1", "parent_code": "P1", "receives_notifications": True}},
            "employees": {"E1": {"code": "E1", "campus_code": "C1"}},
        },
    }


def notices(data):
    return list(data["records"].get("notifications", {}).values())


def test_payment_notice_reaches_student_and_parent_and_names_the_payment():
    data = campus()
    payment = {"code": "PAY-1", "student_code": "S1", "amount": "12500", "method": "upi", "paid_on": "2026-11-10"}
    made = payment_notices(data, payment, {"receipt_number": "RCT-0007"})
    assert len(made) == 2
    assert {n["user_code"] for n in notices(data)} == {"stu", "par"}
    assert all(n["payment_code"] == "PAY-1" and n["screen"] == "fees" and "RCT-0007" in n["body"] for n in notices(data))
    assert payment_notices(campus(), {**payment, "payer": {"name": "Walk-in"}}, {"receipt_number": "RCT-1"}) == []


def test_announcement_notifies_its_campus_but_not_the_author():
    data = campus()
    record = {"code": "ANN-1", "campus_code": "C1", "title": "Holiday", "body": "Closed Friday",
              "published_at": "2026-01-01T00:00:00+00:00"}
    announcement_notices(data, record, author_account="tea")
    assert {n["user_code"] for n in notices(data)} == {"stu", "par"}
    assert all(n["announcement_code"] == "ANN-1" and n["screen"] == "announcements" for n in notices(data))
    future = campus()
    assert announcement_notices(future, {**record, "published_at": "2999-01-01T00:00:00+00:00"}) == []


def test_only_new_absent_or_late_marks_notify():
    data = campus()
    register = {"code": "ATT-1", "session_date": "2026-11-10", "period": 2, "marks": {"S1": "absent", "S2": "present"}}
    absence_notices(data, register, {})
    assert {n["user_code"] for n in notices(data)} == {"stu", "par"}
    assert "period 2" in notices(data)[0]["body"] and notices(data)[0]["screen"] == "attendance"
    again = campus()
    assert absence_notices(again, register, {"S1": "absent"}) == []


def test_clear_read_hides_only_read_notices(client, app):
    from tests.test_screen_workflows import mobile_login
    user = mobile_login(client, app, "boss", "ADMIN-EMP", "admin-mobile")
    with app.state.store.transaction() as d:
        d["accounts"]["boss"]["role_codes"] = list(d["accounts"]["ADMIN"]["role_codes"])
        box = d["records"].setdefault("notifications", {})
        for code, status in (("N-READ", "read"), ("N-NEW", "sent")):
            box[code] = {"code": code, "user_code": "boss", "title": code, "body": "", "channel": "in_app",
                         "status": status, "sent_at": "2026-11-10T09:00:00+00:00"}
    assert client.post("/api/v1/mobile/workspace/notifications/clear-read", headers=user).json() == {"cleared": 1}
    response = client.get("/api/v1/mobile/workspace/notifications", headers=user)
    assert response.status_code == 200, response.text
    listed = response.json()["items"]
    assert [n["code"] for n in listed] == ["N-NEW"]


def test_dashboard_log_shows_others_only_to_the_admin_and_keeps_chats_private():
    from app.modules.communications.notifications.api import PRIVATE_BODY, visible
    data = {"accounts": {"ADMIN": {"role_codes": ["R-ADMIN"]}, "clerk": {"role_codes": ["R-CLERK"]}},
            "roles": {"R-ADMIN": {"system_admin": True}, "R-CLERK": {}}}
    chat = {"code": "N1", "user_code": "teacher", "body": "see you at 4", "thread_code": "T1", "screen": "messages"}
    fee = {"code": "N2", "user_code": "parent", "body": "Rs. 500 received"}
    clerk, admin = {"code": "clerk"}, {"code": "ADMIN"}
    assert visible(data, clerk, chat) is None and visible(data, clerk, fee) is None
    assert visible(data, clerk, {**fee, "user_code": "clerk"})["body"] == "Rs. 500 received"
    assert visible(data, admin, chat)["body"] == PRIVATE_BODY
    assert visible(data, admin, fee)["body"] == "Rs. 500 received"
    assert visible(data, {"code": "teacher"}, chat)["body"] == "see you at 4"


def test_a_phone_token_belongs_only_to_the_last_account_signed_in(client, app):
    from tests.test_screen_workflows import mobile_login
    user = mobile_login(client, app, "boss", "ADMIN-EMP", "admin-mobile")
    token = "phone-token-" + "x" * 20
    with app.state.store.transaction() as d:
        d["records"].setdefault("device_tokens", {}).update({
            "DEV-A": {"code": "DEV-A", "user_code": "someone", "token": token, "platform": "android"},
            "DEV-B": {"code": "DEV-B", "user_code": "other", "token": token, "platform": "android"}})
    assert client.post("/api/v1/mobile/devices/register", headers=user,
                       json={"token": token, "platform": "android"}).status_code == 200
    rows = [r for r in app.state.store.snapshot()["records"]["device_tokens"].values() if r["token"] == token]
    assert [r["user_code"] for r in rows] == ["boss"]


def test_firebase_key_can_come_from_an_app_setting():
    from types import SimpleNamespace
    from pydantic import SecretStr
    from app.core.push_delivery import _service_account
    key = SimpleNamespace(fcm_service_account_json=SecretStr('{"client_email": "push@x.iam", "project_id": "p"}'),
                          fcm_service_account_file=None)
    assert _service_account(key)["project_id"] == "p"
    broken = SimpleNamespace(fcm_service_account_json=SecretStr("not json"), fcm_service_account_file=None)
    assert _service_account(broken) is None
