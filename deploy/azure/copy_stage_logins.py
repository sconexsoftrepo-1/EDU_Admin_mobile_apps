"""Copy production application logins/roles and their identity dependencies to edu_stage.

Explicit user-authorized identity migration only: no sessions, OTPs, device registrations,
payments, grades, messages or file bytes. Password hashes are transferred in memory only.
Run without --apply first to inspect counts; production is accessed through a read-only snapshot.
"""
import argparse
from collections import defaultdict
from copy import deepcopy
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from app.core.sqlserver import SqlServerSettings, SqlServerStore
from app.core.storage import audit

ALLOWED = {"institutions", "campuses", "departments", "programs", "academic_years", "semesters",
           "sections", "subjects", "parents", "students", "employees", "teachers", "staff_profiles",
           "student_parents", "student_enrollments"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-env", type=Path, required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    source_settings = SqlServerSettings(_env_file=args.source_env)
    if source_settings.host != "pragathiedu.database.windows.net" or source_settings.name != "eduadmin":
        raise SystemExit("Unexpected production source")
    private = json.loads((Path(__file__).parent / "out/stage/private-settings.json").read_text())
    target_settings = SqlServerSettings(_env_file=None, host=source_settings.host, name="edu_stage",
                                       user="edunexa_stage", password=private["EDUNEXA_MSSQL_PASSWORD"])
    source, target = SqlServerStore(source_settings), SqlServerStore(target_settings)
    try:
        snapshot = source.snapshot()
        accounts = {k: deepcopy(v) for k, v in snapshot["accounts"].items()}
        roles = {k: deepcopy(v) for k, v in snapshot["roles"].items()}
        records = defaultdict(dict)

        def include(table, code):
            if not code or code in records[table]:
                return
            if table not in ALLOWED:
                raise ValueError("Unexpected identity dependency: " + table)
            row = deepcopy(snapshot["records"][table][code])
            # Account parity does not need production document pointers or admission history.
            if table == "students":
                row["admission_application_code"] = None
                row["aadhaar_number"] = None
            for field in list(row):
                if "storage_key" in field or field in {"appointment_document_reference", "document_url"}:
                    row[field] = None
            records[table][code] = row
            for column, parent, parent_column in snapshot.meta.tables[table].fks:
                if row.get(column) is not None:
                    if parent_column != "code":
                        raise ValueError("Unsupported identity reference")
                    include(parent, row[column])

        types = {"employee": "employees", "student": "students", "parent": "parents"}
        for account in accounts.values():
            if account.get("person_type") in types:
                include(types[account["person_type"]], account["person_code"])
        for link in snapshot["records"]["student_parents"].values():
            if link.get("parent_code") in records["parents"] or link.get("student_code") in records["students"]:
                include("student_parents", link["code"])
        for table in ("teachers", "staff_profiles"):
            for row in snapshot["records"][table].values():
                if row.get("employee_code") in records["employees"]:
                    include(table, row["code"])
        for row in snapshot["records"]["student_enrollments"].values():
            if row.get("student_code") in records["students"]:
                include("student_enrollments", row["code"])
        print("Production login/role counts:", len(accounts), len(roles))
        print("Required identity record counts:", {k: len(v) for k, v in sorted(records.items()) if v})
        if not args.apply:
            print("Preview only; no stage writes")
            return
        with target.transaction() as data:
            # Preserve bootstrap audit references while retiring the temporary test login.
            for account in data["accounts"].values():
                if account.get("login_id") == "stage.admin":
                    account.update(active=False, email=None)
            data.sync()
            for table, rows in records.items():
                for code, row in rows.items():
                    data["records"][table][code] = row
            for code, role in roles.items():
                data["roles"][code] = role
            for code, account in accounts.items():
                data["accounts"][code] = account
            audit(data, "system", "stage_identity_copy", "accounts", "stage")
        copied = target.snapshot()
        for code, account in accounts.items():
            actual = copied["accounts"][code]
            for key in ("login_id", "password_hash", "active", "person_type", "person_code", "role_codes", "clients", "email"):
                if actual.get(key) != account.get(key):
                    raise ValueError("Copied account parity check failed for field " + key)
        allowed = sorted({a["email"].strip().casefold() for a in accounts.values() if a.get("active") and a.get("email")})
        if not allowed:
            raise ValueError("No active production login emails available for OTP parity")
        private["EDUNEXA_EMAIL_ALLOWED_RECIPIENTS"] = json.dumps(allowed)
        output = Path(__file__).parent / "out/stage/private-settings.json"
        output.write_text(json.dumps(private, indent=2))
        output.chmod(0o600)
        print("Production login IDs, password hashes, roles and client policies matched in stage; sessions/devices were not copied")
    finally:
        source.close()
        target.close()


if __name__ == "__main__":
    main()
