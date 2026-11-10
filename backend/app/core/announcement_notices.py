"""Inbox notices (and phone pushes) for a published announcement.

The audience is everyone the announcement is visible to in the apps: staff and students of its
campus and the parents of those students.
"""

from .storage import new_code, now


def audience(data, campus_code):
    records = data["records"]
    students = {c for c, s in records.get("students", {}).items() if s.get("campus_code") == campus_code}
    parents = {r["parent_code"] for r in records.get("student_parents", {}).values()
               if r.get("student_code") in students and r.get("receives_notifications", True)}
    employees = {c for c, e in records.get("employees", {}).items() if e.get("campus_code") == campus_code}
    people = {"student": students, "parent": parents, "employee": employees}
    return {a["code"] for a in data.get("accounts", {}).values()
            if a.get("active") and a.get("person_code") in people.get(a.get("person_type"), ())}


def announcement_notices(data, record, author_account=None):
    """Notify the audience of a published announcement; returns the new notice codes to push."""
    if not record.get("campus_code") or not record.get("published_at") or str(record["published_at"]) > now():
        return []
    made = []
    body = str(record.get("body") or "")
    for account in sorted(audience(data, record["campus_code"]) - {author_account}):
        code = new_code("ANOTICE")
        data["records"].setdefault("notifications", {})[code] = {
            "code": code, "user_code": account, "title": f"Announcement: {record.get('title') or 'College update'}",
            "body": body[:240], "channel": "in_app", "status": "sent", "sent_at": now(),
            "screen": "announcements", "announcement_code": record["code"]}
        made.append(code)
    return made
