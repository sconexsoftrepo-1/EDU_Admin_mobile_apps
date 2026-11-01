from tests.test_screen_workflows import classroom, mobile_login


def test_parent_and_teacher_see_who_they_message_and_are_notified(client, seeded):
    classroom(seeded)
    parent = mobile_login(client, seeded, "parent", "P1", "parent-mobile")
    teacher = mobile_login(client, seeded, "teacher", "E1", "teacher-mobile")

    # The parent's contacts are the child's teachers, labelled with what they teach.
    parent_contacts = client.get("/api/v1/mobile/workspace/messages", headers=parent).json()["lookups"]["contacts"]
    staff = next(c for c in parent_contacts if c["code"] == "teacher")
    assert staff["role"] == "teacher" and staff["detail"].startswith("Teacher · ")

    # The teacher's contacts include the parents of students in the classes they teach.
    teacher_contacts = client.get("/api/v1/mobile/workspace/messages", headers=teacher).json()["lookups"]["contacts"]
    family = next(c for c in teacher_contacts if c["code"] == "parent")
    assert family["role"] == "parent" and family["detail"].startswith("Parent of ")

    started = client.post(
        "/api/v1/mobile/workspace/messages/actions/start_thread",
        headers=teacher,
        json={"values": {"recipient_user_code": "parent", "subject": "Lab record", "body": "Please submit the lab record."}},
    )
    assert started.status_code == 201, started.text
    thread = started.json()["record"]["thread_code"]

    notices = client.get("/api/v1/mobile/workspace/notifications", headers=parent).json()["items"]
    notice = next(n for n in notices if n.get("thread_code") == thread)
    assert notice["screen"] == "messages" and notice["title"].startswith("New message from")

    reply = client.post(
        "/api/v1/mobile/workspace/messages/actions/send_message",
        headers=parent,
        json={"values": {"thread_code": thread, "body": "Will do, thank you."}},
    )
    assert reply.status_code == 201, reply.text
    teacher_notices = client.get("/api/v1/mobile/workspace/notifications", headers=teacher).json()["items"]
    assert any(n.get("thread_code") == thread for n in teacher_notices)

    messages = client.get("/api/v1/mobile/workspace/messages", headers=parent).json()["items"]
    mine = next(m for m in messages if m["body"] == "Will do, thank you.")
    theirs = next(m for m in messages if m["body"] == "Please submit the lab record.")
    assert mine["mine"] and not theirs["mine"]
    assert theirs["thread_subject"] == "Lab record" and theirs["with"]
