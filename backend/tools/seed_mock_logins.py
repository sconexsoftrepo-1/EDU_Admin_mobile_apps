"""Add isolated mock identities and one login per configured role; never reset accounts.

Run from backend/: .venv/bin/python tools/seed_mock_logins.py
Credentials are written exclusively to the ignored, owner-only ../mock_logins.txt.
"""

import os
import secrets
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.resources import ensure_references, validate_record
from app.core.security import hasher
from app.core.settings import Settings
from app.core.storage import audit, new_code
from create_master_data_role import store_for


def main():
    settings = Settings()
    store = store_for(settings)
    output = Path(__file__).resolve().parents[2] / "mock_logins.txt"
    try:
        with store.transaction() as data:
            roles = sorted(data["roles"].values(), key=lambda r: r["name"])
            campus = next(iter(data["records"]["campuses"].values()))
            department = next(d for d in data["records"]["departments"].values()
                              if d["campus_code"] == campus["code"])
            credentials = []

            def add(table, row):
                if row["code"] in data["records"].get(table, {}):
                    raise ValueError(f"Mock identity already exists: {table}/{row['code']}")
                row = validate_record(table, row)
                ensure_references(data, table, row)
                data["records"].setdefault(table, {})[row["code"]] = row
                audit(data, "system", "create", table, row["code"])

            add("students", {
                "code": "MOCK-STUDENT", "campus_code": campus["code"],
                "admission_number": "MOCK-ADM-2026-001", "first_name": "Mock",
                "last_name": "Student", "date_of_birth": "2007-06-15", "gender": "female",
                "email": "mock.student@example.test", "admission_date": str(date.today()),
                "address": "Mock address", "city": "Chennai", "state": "Tamil Nadu",
                "postal_code": "600001", "country": "India", "status": "active",
                "emergency_contact_name": "Mock Parent", "emergency_contact_phone": "9999900099",
            })
            add("parents", {"code": "MOCK-PARENT", "first_name": "Mock", "last_name": "Parent",
                            "email": "mock.parent@example.test", "phone": "9999900099"})
            add("student_parents", {"code": "MOCK-FAMILY", "student_code": "MOCK-STUDENT",
                                    "parent_code": "MOCK-PARENT", "relationship": "guardian",
                                    "is_primary": True, "can_pickup": True,
                                    "receives_notifications": False})
            for role in roles:
                slug = {"SYSTEM-ADMIN": "admin", "FACULTY": "teacher"}.get(
                    role["code"], role["code"].lower().replace("-", "."))
                login = "mock." + slug
                if any(a["login_id"].casefold() == login.casefold() for a in data["accounts"].values()):
                    raise ValueError(f"Refusing to change existing login {login}")
                kind = "student" if role["code"] == "STUDENT" else "parent" if role["code"] == "PARENT" else "employee"
                person = "MOCK-" + role["code"]
                clients = ["admin-web"]
                if kind in {"student", "parent"}:
                    clients.append(kind + "-mobile")
                else:
                    teaching = role.get("scope") == "teaching"
                    clients.append("teacher-mobile" if teaching else "admin-mobile")
                    add("employees", {
                        "code": person, "campus_code": campus["code"],
                        "department_code": department["code"], "first_name": "Mock",
                        "last_name": role["name"], "designation": role["name"],
                        "employee_type": "teacher" if teaching else "staff",
                        "email": login + "@example.test", "join_date": str(date.today()),
                        "employment_type": "permanent", "status": "active",
                    })
                    if teaching:
                        add("teachers", {"code": "MOCK-TEACHER-" + role["code"],
                                         "employee_code": person, "qualification": "M.Sc.",
                                         "specialization": "Mock teaching profile", "experience_years": "5"})
                password = "Mock!" + secrets.token_urlsafe(15)
                code = new_code("USR")
                data["accounts"][code] = {
                    "code": code, "login_id": login, "password_hash": hasher.hash(password),
                    "active": True, "person_type": kind, "person_code": person,
                    "role_codes": [role["code"]], "clients": clients,
                }
                audit(data, "system", "create", "accounts", code)
                credentials.append((role, login, password, person, clients))

            lines = ["EduNexa mock logins", f"Created: {date.today()}",
                     f"Database backend: {settings.storage_backend}",
                     "Status: PENDING DATABASE COMMIT / VERIFICATION",
                     "", "All accounts use the existing role permissions. Select the named role on web login.",
                     "Admin & Teacher app: select Admin for admin-mobile or Teacher for teacher-mobile.",
                     "Parent & Student app: select the matching Parent or Student toggle.",
                     "Parent and Student accounts share the MOCK-FAMILY link.",
                     "Only login/profile mock data is created; class enrollments and financial data are not seeded.",
                     ""]
            for role, login, password, person, clients in credentials:
                lines.extend([f"Role: {role['name']} ({role['code']})", f"Login ID: {login}",
                              f"Password: {password}", f"Profile: {person}",
                              f"Clients: {', '.join(clients)}", ""])
            content = "\n".join(lines)
            # Exclusive creation prevents overwriting a previous credential export.
            fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w") as handle:
                handle.write(content)
        output.write_text(content.replace("PENDING DATABASE COMMIT / VERIFICATION", "DATABASE COMMITTED; authentication verification pending"))
        print(f"Created {len(credentials)} mock accounts. Credentials: {output}")
    finally:
        if hasattr(store, "close"):
            store.close()


if __name__ == "__main__":
    main()
