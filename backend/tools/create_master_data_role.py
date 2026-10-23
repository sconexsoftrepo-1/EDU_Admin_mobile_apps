"""Create (or update) the "Master Data Entry" role and, optionally, a login that uses it.

The role sees only the master data screens: student enrollment (with father/mother details and
certificate uploads), teaching and non-teaching staff onboarding (with salary/pay structure),
courses & enrollment (courses, year-based batches, enrolling students), and imports of client
workbooks 01-06.

    python tools/create_master_data_role.py                      # role only
    python tools/create_master_data_role.py --login Pragathi     # role + account (password prompted)

The password is read from EDUNEXA_NEW_PASSWORD or prompted; it is never written to a file. Uses
the configured storage (EDUNEXA_STORAGE_BACKEND: postgres or local-json). An existing account is
left unchanged unless --reset-password is given.
"""

import argparse
import getpass
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.security import hasher
from app.core.settings import Settings
from app.core.storage import Store, audit, new_code

ROLE_CODE = "MASTER-DATA-ENTRY"
EDIT = ["view", "create", "edit"]
PERMISSIONS = {
    # student and parent enrollment
    "students": EDIT, "parents": EDIT, "student_parents": EDIT,
    # admission form and certificate uploads
    "admission_applications": EDIT, "application_guardians": EDIT, "application_qualifications": EDIT,
    "admission_documents": ["view", "create"], "documents": ["view", "create"],
    # teaching and non-teaching staff onboarding, salary and pay structure
    "employees": EDIT, "teachers": EDIT, "staff_profiles": EDIT, "employee_salary_components": EDIT,
    # course fee structures (annual; hostel and bus fees charged only when chosen) and fee charges
    "fee_heads": EDIT, "fee_structures": EDIT, "student_fee_charges": ["view", "create"],
    # courses, year-based batches and course enrollment
    "academic_years": EDIT, "departments": EDIT, "programs": EDIT + ["delete"], "batches": EDIT + ["delete"],
    "semesters": EDIT,
    "sections": EDIT, "subjects": EDIT, "curriculum_subjects": EDIT, "student_enrollments": EDIT,
    # client workbook imports
    "import_jobs": ["view", "create", "approve"], "import_rows": ["view"],
    # lookups used by the forms
    "institutions": ["view"], "campuses": ["view"], "document_types": ["view"],
    "admission_sources": ["view"], "admission_cycles": ["view"],
}
# Setup first: courses and batches, then their fee structures, then student and staff entry.
SCREENS = ["course-setup", "fee-structures", "student-enrollment", "teaching-staff", "non-teaching-staff",
           "daily-labour", "imports"]
IMPORT_FILES = ["01_Students_and_Parents.xlsx", "02_Courses_and_Subjects.xlsx", "03_Employees.xlsx",
                "04_Teachers.xlsx", "05_Staff.xlsx", "06_Student_Enrollments.xlsx"]


def store_for(settings):
    if settings.storage_backend == "postgres":
        from app.core.sql_store import PostgresStore

        return PostgresStore()
    return Store(settings.data_dir)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--login", help="login ID for an account with this role")
    parser.add_argument("--reset-password", action="store_true", help="set a new password on an existing account")
    args = parser.parse_args()
    store = store_for(Settings())

    password = None
    if args.login:
        password = os.environ.get("EDUNEXA_NEW_PASSWORD") or getpass.getpass(f"Password for {args.login}: ")
        if not 12 <= len(password) <= 128:
            raise SystemExit("Password must be 12-128 characters")

    with store.transaction() as data:
        role = data["roles"].get(ROLE_CODE)
        values = {"code": ROLE_CODE, "name": "Master Data Entry", "scope": "college", "system_admin": False,
                  "permissions": PERMISSIONS, "screens": SCREENS, "import_files": IMPORT_FILES}
        if role is None:
            data["roles"][ROLE_CODE] = values
            audit(data, "system", "create", "roles", ROLE_CODE)
            print("Role created: Master Data Entry")
        else:
            role.update(values)
            audit(data, "system", "edit", "roles", ROLE_CODE)
            print("Role updated: Master Data Entry")

        if args.login:
            account = next((a for a in data["accounts"].values() if a["login_id"].casefold() == args.login.casefold()), None)
            if account and not args.reset_password:
                if ROLE_CODE not in account["role_codes"]:
                    account["role_codes"] = [*account["role_codes"], ROLE_CODE]
                print(f"Account {account['login_id']} exists; role assigned, password unchanged")
            elif account:
                account["password_hash"] = hasher.hash(password)
                account["role_codes"] = sorted({*account["role_codes"], ROLE_CODE})
                audit(data, "system", "password_reset", "accounts", account["code"])
                print(f"Account {account['login_id']}: password reset, role assigned")
            else:
                code = new_code("USR")
                data["accounts"][code] = {
                    "code": code, "login_id": args.login, "password_hash": hasher.hash(password),
                    "active": True, "person_type": "system", "person_code": "master-data-entry",
                    "role_codes": [ROLE_CODE], "clients": ["admin-web"],
                }
                audit(data, "system", "create", "accounts", code)
                print(f"Account created: {args.login} (web portal, Master Data Entry)")
    if hasattr(store, "close"):
        store.close()


if __name__ == "__main__":
    main()
