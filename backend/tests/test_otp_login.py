"""Staff sign-in with an emailed one-time code."""
import re

import pytest

from app.core import otp_login

REQUEST = "/api/v1/auth/otp/request"
VERIFY = "/api/v1/auth/otp/verify"


@pytest.fixture
def mailbox(app, monkeypatch):
    sent = []
    monkeypatch.setattr(otp_login, "send_email", lambda settings, to, subject, text, html=None, **kwargs: sent.append(
        {"to": to, "subject": subject, "text": text, "html": html}) or True)
    with app.state.store.transaction() as d:
        d["accounts"]["ADMIN"]["email"] = "admin@pragathiews.org"
    return sent


def code_of(mail):
    return re.search(r"\b(\d{6})\b", mail["subject"]).group(1)


def test_code_by_email_signs_in_like_a_password(client, mailbox):
    asked = client.post(REQUEST, json={"login": "admin", "client": "admin-web"})
    assert asked.status_code == 200 and asked.json()["sent"] is True
    assert len(mailbox) == 1 and mailbox[0]["to"] == "admin@pragathiews.org"
    mail = mailbox[0]
    assert "EduNexa Admin" in mail["subject"] and "Dear Test Administrator" in mail["text"] and "5 minutes" in mail["text"]
    signed = client.post(VERIFY, json={"login": "admin", "code": code_of(mail), "client": "admin-web"})
    assert signed.status_code == 200, signed.text
    body = signed.json()
    assert body["access_token"] and body["refresh_token"] and body["account"]["login_id"] == "admin"
    assert body["roles"][0]["code"] == "ROOT"
    me = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + body["access_token"]})
    assert me.status_code == 200
    # One use only.
    again = client.post(VERIFY, json={"login": "admin", "code": code_of(mail), "client": "admin-web"})
    assert again.status_code == 401


def test_email_address_works_as_login_and_app_name_follows_the_client(client, mailbox):
    client.post(REQUEST, json={"login": "ADMIN@PragathiEWS.org", "client": "admin-mobile"})
    assert len(mailbox) == 1 and "EduDesk" in mailbox[0]["subject"]
    ok = client.post(VERIFY, json={"login": "admin@pragathiews.org", "code": code_of(mailbox[0]), "client": "admin-mobile"})
    assert ok.status_code == 200
    # A code made for the app does not sign in on the web.
    client.app.state  # noqa: B018
    wrong_client = client.post(VERIFY, json={"login": "admin", "code": code_of(mailbox[0]), "client": "admin-web"})
    assert wrong_client.status_code == 401


def test_requests_never_reveal_whether_a_login_exists(client, mailbox):
    known = client.post(REQUEST, json={"login": "admin", "client": "admin-web"}).json()
    unknown = client.post(REQUEST, json={"login": "nobody@example.com", "client": "admin-web"}).json()
    assert known == unknown and len(mailbox) == 1


def test_wrong_codes_are_limited_and_codes_expire(client, mailbox, app):
    client.post(REQUEST, json={"login": "admin", "client": "admin-web"})
    real = code_of(mailbox[0])
    wrong = "000000" if real != "000000" else "111111"
    for _ in range(otp_login.MAX_TRIES):
        assert client.post(VERIFY, json={"login": "admin", "code": wrong, "client": "admin-web"}).status_code == 401
    # After five wrong tries the real code no longer works either.
    assert client.post(VERIFY, json={"login": "admin", "code": real, "client": "admin-web"}).status_code == 401
    # A resend within 60 seconds sends nothing new.
    client.post(REQUEST, json={"login": "admin", "client": "admin-web"})
    assert len(mailbox) == 1
    # An expired code is refused.
    with app.state.store.transaction() as d:
        d["documents"]["login_otps"].pop("ADMIN", None)
        d["documents"]["login_otps"]["ADMIN"] = {
            "hash": otp_login.code_hash(app.state.settings, "ADMIN", "123456"), "client": "admin-web",
            "expires": 1, "tries": 0, "sent": []}
    assert client.post(VERIFY, json={"login": "admin", "code": "123456", "client": "admin-web"}).status_code == 401


def test_parents_students_and_logins_without_email_get_no_code(client, mailbox, app):
    with app.state.store.transaction() as d:
        d["accounts"]["PAR"] = {"code": "PAR", "login_id": "parent.one", "password_hash": "x", "active": True,
                                "person_type": "parent", "person_code": "P1", "role_codes": [],
                                "clients": ["parent-mobile"], "email": "parent@example.com"}
        d["accounts"]["NOMAIL"] = {"code": "NOMAIL", "login_id": "staff.nomail", "password_hash": "x", "active": True,
                                   "person_type": "employee", "person_code": "E9", "role_codes": ["ROOT"],
                                   "clients": ["admin-web"]}
    assert client.post(REQUEST, json={"login": "parent@example.com", "client": "admin-web"}).status_code == 200
    assert client.post(REQUEST, json={"login": "staff.nomail", "client": "admin-web"}).status_code == 200
    assert mailbox == []
    # The parent app itself cannot ask for a code.
    assert client.post(REQUEST, json={"login": "parent.one", "client": "parent-mobile"}).status_code == 422


def test_role_choice_is_respected(client, mailbox):
    client.post(REQUEST, json={"login": "admin", "client": "admin-web"})
    refused = client.post(VERIFY, json={"login": "admin", "code": code_of(mailbox[0]), "client": "admin-web",
                                        "role_code": "SOMETHING-ELSE"})
    assert refused.status_code == 403


def test_a_code_is_only_sent_for_a_role_the_login_holds(client, mailbox):
    wrong = client.post(REQUEST, json={"login": "admin", "client": "admin-web", "role_code": "TEACHER"})
    assert wrong.status_code == 403 and "select the role assigned" in wrong.json()["detail"]
    assert mailbox == []
    # Unknown logins still get the neutral answer: the page never reveals which logins exist.
    unknown = client.post(REQUEST, json={"login": "nobody@example.com", "client": "admin-web", "role_code": "TEACHER"})
    assert unknown.status_code == 200 and mailbox == []
    client.post(REQUEST, json={"login": "admin", "client": "admin-web", "role_code": "ROOT"})
    assert len(mailbox) == 1


def test_staff_password_sign_in_can_be_switched_off(client, app):
    app.state.settings.staff_password_login = False
    try:
        staff = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "Strong-Test-Password-245!",
                                                         "client": "admin-web"})
        assert staff.status_code == 403 and "code sent to their email" in staff.text
        wrong = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "wrong-password-000",
                                                         "client": "admin-web"})
        assert wrong.status_code == 401  # a wrong password says nothing about the account
    finally:
        app.state.settings.staff_password_login = True


def test_app_sessions_last_until_logout_web_sessions_stay_short(client, app):
    import time
    from app.core.security import issue
    with app.state.store.transaction() as d:
        account = d["accounts"]["ADMIN"]
        issue(d, account, "admin-mobile", app.state.settings)
        issue(d, account, "admin-web", app.state.settings)
        sessions = sorted(d["sessions"].values(), key=lambda s: s["expires_at"])
    web, mobile = sessions[-2]["expires_at"] - time.time(), sessions[-1]["expires_at"] - time.time()
    assert 29 * 86400 < web <= 30 * 86400 and mobile > 360 * 86400
