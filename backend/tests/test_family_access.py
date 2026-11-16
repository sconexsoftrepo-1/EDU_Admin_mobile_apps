"""EduNest first sign-in for students and parents, shared login, and welcome emails."""
import re

import pytest

from app.core import family_access

REQUEST = "/api/v1/auth/first-time/request"
VERIFY = "/api/v1/auth/first-time/verify"
LOGIN = "/api/v1/auth/login"


@pytest.fixture
def family(app, monkeypatch):
    sent = []
    monkeypatch.setattr(family_access, "send_email",
                        lambda settings, to, subject, text, html=None: sent.append({"to": to, "subject": subject, "text": text}) or True)
    with app.state.store.transaction() as d:
        d["roles"]["STUDENT"] = {"code": "STUDENT", "name": "Student", "scope": "self", "system_admin": False, "permissions": {}}
        d["roles"]["PARENT"] = {"code": "PARENT", "name": "Parent", "scope": "self", "system_admin": False, "permissions": {}}
        r = d["records"]
        r.setdefault("programs", {})["POLY-CME"] = {"code": "POLY-CME", "name": "Diploma in Computer Engineering", "branch": "CME"}
        r.setdefault("students", {})["S1"] = {"code": "S1", "first_name": "Ravi", "last_name": "Kumar", "status": "active",
                                              "admission_number": "PRA-2026-001", "email": "ravi@student.example"}
        r.setdefault("parents", {})["P1"] = {"code": "P1", "first_name": "Lakshmi", "last_name": "Kumar", "email": "lakshmi@parent.example"}
        r.setdefault("student_parents", {})["L1"] = {"code": "L1", "student_code": "S1", "parent_code": "P1",
                                                     "relationship": "mother", "is_primary": True, "receives_notifications": True}
        r.setdefault("student_admission_profiles", {})["SAP1"] = {"code": "SAP1", "student_code": "S1", "program_code": "POLY-CME",
                                                                  "reference_number": "REF-26-0042"}
    return sent


def code_in(mail):
    return re.search(r"\b(\d{6})\b", mail["subject"]).group(1)


def test_student_first_sign_in_creates_both_logins_and_emails_the_parent(client, family):
    asked = client.post(REQUEST, json={"login_id": "PRA-2026-001", "email": "Ravi@Student.example", "client": "student-mobile"})
    assert asked.status_code == 200 and len(family) == 1 and family[0]["to"] == "ravi@student.example"
    made = client.post(VERIFY, json={"login_id": "PRA-2026-001", "email": "ravi@student.example", "client": "student-mobile",
                                     "code": code_in(family[0]), "password": "Ravi2026pass"})
    assert made.status_code == 200, made.text
    assert made.json()["account"]["person_type"] == "student" and made.json()["access_token"]
    # The parent gets the login ID and the password.
    parent_mail = family[-1]
    assert parent_mail["to"] == "lakshmi@parent.example"
    assert "PRA-2026-001" in parent_mail["text"] and "Ravi2026pass" in parent_mail["text"]
    # Student signs in with admission number or reference number; parent with the same ID and password.
    for login in ("PRA-2026-001", "REF-26-0042"):
        ok = client.post(LOGIN, json={"login_id": login, "password": "Ravi2026pass", "client": "student-mobile"})
        assert ok.status_code == 200 and ok.json()["account"]["person_code"] == "S1"
    parent = client.post(LOGIN, json={"login_id": "PRA-2026-001", "password": "Ravi2026pass", "client": "parent-mobile"})
    assert parent.status_code == 200, parent.text
    assert parent.json()["account"]["person_type"] == "parent" and parent.json()["account"]["person_code"] == "P1"
    wrong = client.post(LOGIN, json={"login_id": "PRA-2026-001", "password": "not-the-one-1", "client": "parent-mobile"})
    assert wrong.status_code == 401


def test_parent_can_do_the_first_sign_in_with_their_own_email(client, family):
    client.post(REQUEST, json={"login_id": "REF-26-0042", "email": "lakshmi@parent.example", "client": "parent-mobile"})
    assert family[0]["to"] == "lakshmi@parent.example"
    made = client.post(VERIFY, json={"login_id": "REF-26-0042", "email": "lakshmi@parent.example", "client": "parent-mobile",
                                     "code": code_in(family[0]), "password": "Family2026x"})
    assert made.status_code == 200 and made.json()["account"]["person_type"] == "parent"


def test_wrong_email_or_login_sends_nothing_and_says_the_same(client, family):
    a = client.post(REQUEST, json={"login_id": "PRA-2026-001", "email": "someone@else.example", "client": "student-mobile"}).json()
    b = client.post(REQUEST, json={"login_id": "NOPE-1", "email": "ravi@student.example", "client": "student-mobile"}).json()
    c = client.post(REQUEST, json={"login_id": "PRA-2026-001", "email": "lakshmi@parent.example", "client": "student-mobile"}).json()
    assert a == b == c and family == []


def test_codes_expire_and_wrong_codes_are_limited(client, family):
    client.post(REQUEST, json={"login_id": "PRA-2026-001", "email": "ravi@student.example", "client": "student-mobile"})
    real = code_in(family[0])
    wrong = "000000" if real != "000000" else "111111"
    body = {"login_id": "PRA-2026-001", "email": "ravi@student.example", "client": "student-mobile", "password": "Ravi2026pass"}
    for _ in range(family_access.MAX_TRIES):
        assert client.post(VERIFY, json={**body, "code": wrong}).status_code == 401
    assert client.post(VERIFY, json={**body, "code": real}).status_code == 401


def test_weak_passwords_are_refused(client, family):
    client.post(REQUEST, json={"login_id": "PRA-2026-001", "email": "ravi@student.example", "client": "student-mobile"})
    weak = client.post(VERIFY, json={"login_id": "PRA-2026-001", "email": "ravi@student.example", "client": "student-mobile",
                                     "code": code_in(family[0]), "password": "onlyletters"})
    assert weak.status_code == 422


def test_welcome_emails_name_the_course_login_and_app(app, family):
    with app.state.store.transaction() as d:
        mails = family_access.welcome_emails(d, app.state.settings, "S1")
    assert [m[0] for m in mails] == ["ravi@student.example", "lakshmi@parent.example"]
    student_text, parent_text = mails[0][2], mails[1][2]
    for text in (student_text, parent_text):
        assert "Diploma in Computer Engineering (CME)" in text and "PRA-2026-001" in text
        assert "EduNest" in text and "Fees and payments" in text and "Chats" in text and "First sign-in" in text
    assert "your ward Ravi Kumar" in parent_text and "choose Parent" in parent_text
    assert "Pragathi Educational Institutions" in mails[0][3] and "<html" in mails[0][3]
