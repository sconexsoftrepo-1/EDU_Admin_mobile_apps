"""Create the first administrator interactively. No default or shared password.

Uses the configured storage (EDUNEXA_STORAGE_BACKEND: postgres or local-json). Allowed only while
no system administrator account exists; other accounts (e.g. data entry users) may already exist.
"""

import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.security import hasher
from app.core.settings import Settings
from app.core.storage import audit, new_code
from create_master_data_role import store_for


def main():
    settings = Settings()
    store = store_for(settings)
    login = input("Administrator login ID: ").strip()
    password = getpass.getpass("Password (at least 12 characters): ")
    if not 3 <= len(login) <= 120 or not 12 <= len(password) <= 128:
        raise SystemExit("Invalid login or password length")
    if password != getpass.getpass("Confirm password: "):
        raise SystemExit("Passwords do not match")
    with store.transaction() as data:
        admins = {code for code, r in data["roles"].items() if r.get("system_admin")}
        if any(admins & set(a.get("role_codes", [])) for a in data["accounts"].values()):
            raise SystemExit("An administrator already exists; bootstrap is allowed only once")
        if any(a["login_id"].casefold() == login.casefold() for a in data["accounts"].values()):
            raise SystemExit(f"Login ID {login} is already in use")
        role = {
            "code": "SYSTEM-ADMIN",
            "name": "System Administrator",
            "permissions": {},
            "system_admin": True,
        }
        account = {
            "code": new_code("USR"),
            "login_id": login,
            "password_hash": hasher.hash(password),
            "person_type": "system",
            "person_code": "bootstrap",
            "role_codes": [role["code"]],
            "clients": ["admin-web", "admin-mobile"],
            "active": True,
        }
        data["roles"][role["code"]] = role
        data["accounts"][account["code"]] = account
        audit(data, account["code"], "bootstrap", "accounts", account["code"])
    if hasattr(store, "close"):
        store.close()
    print("Administrator created. Password was hashed and was not logged.")


if __name__ == "__main__":
    main()
