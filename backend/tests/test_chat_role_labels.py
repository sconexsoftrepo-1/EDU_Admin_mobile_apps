"""Chat labels follow assigned roles, not a shared employee designation."""
from app.core.chat_workspace import account_role, contact, describe, role_label


def test_assigned_roles_are_named_deduplicated_and_separate_from_chat_categories():
    data = {"roles": {"FIN": {"name": "Accounts Manager"}, "HR": {"name": "HR Manager"},
                      "OLD": {"name": "Old role", "active": False}},
            "records": {"employees": {"E": {"code": "E", "designation": "Administration", "first_name": "Asha"}}}}
    account = {"code": "U", "person_type": "employee", "person_code": "E", "role_codes": ["FIN", "HR", "FIN", "OLD", "MISSING"]}
    assert role_label(data, account) == "Accounts Manager, HR Manager"
    assert describe(data, account) == "Accounts Manager, HR Manager"
    assert contact(data, account)["role_label"] == "Accounts Manager, HR Manager"
    assert account_role(data, account) == "staff"
    account["person_type"] = "system"
    assert describe(data, account) == "Accounts Manager, HR Manager"


def test_teacher_subject_and_parent_relationship_context_are_retained():
    data = {"roles": {"T": {"name": "Lecturer"}, "P": {"name": "Guardian"}}, "records": {
        "employees": {"E": {"code": "E", "first_name": "Teacher", "designation": "Administration"}},
        "teachers": {"T1": {"code": "T1", "employee_code": "E"}},
        "subject_offerings": {"O": {"teacher_code": "T1", "subject_code": "M", "section_code": "SEC"}},
        "subjects": {"M": {"name": "Mathematics"}},
        "parents": {"P1": {"code": "P1"}},
        "students": {"S": {"first_name": "Student", "last_name": "One"}},
        "student_parents": {"SP": {"parent_code": "P1", "student_code": "S"}},
    }}
    teacher = {"person_type": "employee", "person_code": "E", "role_codes": ["T"]}
    assert describe(data, teacher) == "Lecturer · Mathematics"
    assert account_role(data, teacher) == "teacher"
    parent = {"person_type": "parent", "person_code": "P1", "role_codes": ["P"]}
    assert describe(data, parent) == "Guardian · Parent of Student One"
    teacher["role_codes"] = []
    assert describe(data, teacher) == "Administration · Mathematics"


def seed_chat(app, kind="direct"):
    with app.state.store.transaction() as data:
        data["roles"].update({"FIN": {"code": "FIN", "name": "Accounts Manager", "scope": "college", "permissions": {}},
                              "HR": {"code": "HR", "name": "HR Manager", "scope": "college", "permissions": {}}})
        data["accounts"]["CHAT-USER"] = {"code": "CHAT-USER", "login_id": "chat-user", "active": True,
            "person_type": "employee", "person_code": "CHAT-EMP", "role_codes": ["FIN"], "clients": ["admin-web"]}
        records = data["records"]
        records.setdefault("employees", {})["CHAT-EMP"] = {"code": "CHAT-EMP", "first_name": "Asha", "last_name": "Rao", "designation": "Administration"}
        records.setdefault("message_threads", {})["CHAT-T"] = {"code": "CHAT-T", "kind": kind, "title": "College team", "posting": "all"}
        records.setdefault("thread_members", {}).update({
            "CHAT-M1": {"code": "CHAT-M1", "thread_code": "CHAT-T", "user_code": "ADMIN"},
            "CHAT-M2": {"code": "CHAT-M2", "thread_code": "CHAT-T", "user_code": "CHAT-USER"},
        })
        records.setdefault("messages", {})["CHAT-MSG"] = {"code": "CHAT-MSG", "thread_code": "CHAT-T", "sender_code": "CHAT-USER",
            "body": "A test message", "kind": "text", "sent_at": "2026-11-20T06:00:00+00:00"}


def test_directory_conversations_and_message_labels_follow_role_changes(client, headers, app):
    seed_chat(app)
    for expected, next_roles in [("Accounts Manager", ["HR"]), ("HR Manager", ["FIN", "HR"]), ("Accounts Manager, HR Manager", None)]:
        directory = client.get("/api/v1/chat/directory", headers=headers)
        assert directory.status_code == 200, directory.text
        person = next(item for item in directory.json()["items"] if item["code"] == "CHAT-USER")
        assert person["role_label"] == person["detail"] == expected
        listing = client.get("/api/v1/chat/conversations", headers=headers)
        assert listing.status_code == 200, listing.text
        thread = next(item for item in listing.json()["items"] if item["code"] == "CHAT-T")
        assert thread["role_label"] == thread["subtitle"] == expected
        messages = client.get("/api/v1/chat/conversations/CHAT-T/messages", headers=headers)
        assert messages.status_code == 200, messages.text
        assert messages.json()["items"][0]["sender_role_label"] == expected
        if next_roles:
            with app.state.store.transaction() as data:
                data["accounts"]["CHAT-USER"]["role_codes"] = next_roles


def test_group_member_labels_use_current_role_names(client, headers, app):
    seed_chat(app, "group")
    response = client.get("/api/v1/chat/conversations/CHAT-T", headers=headers)
    assert response.status_code == 200, response.text
    person = next(p for p in response.json()["people"] if p["code"] == "CHAT-USER")
    assert person["role_label"] == "Accounts Manager"
