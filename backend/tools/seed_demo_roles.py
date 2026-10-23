"""Create the template's college roles with their screen allocation (idempotent).

These are the roles the admin portal template offered on its sign-in page (Principal, Accounts
Manager, Admission Officer, ...). Each role gets:
  - screens: the workspace screens allocated to it (the template's per-role screen list), and
  - permissions: view/create/edit/export (plus approve for officer roles) on every table those
    screens use (the dashboard grants none); student, parent and teaching roles use the
    identity-scoped portals instead.
"Super Admin" is the system administrator role. Existing roles are left as the administrator
edited them unless --reset is given. Administrators change allocations and assign users to
roles in Roles & access.

    python tools/seed_demo_roles.py            # add missing roles
    python tools/seed_demo_roles.py --reset    # restore the template allocation for these roles
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.core.resources import CATALOG
from app.core.settings import Settings
from app.core.storage import audit
from create_master_data_role import store_for

SCREENS = {s["key"]: s for s in json.loads((ROOT / "app/contracts/screens.json").read_text())}
TRANSPORT = ["transport", "buses", "routes", "route-stops", "drivers", "driver-allocation", "student-allocation",
             "faculty-allocation", "bus-seating", "trips", "manifest", "transport-attendance",
             "vehicle-maintenance", "fuel", "transport-expenses", "transport-reports"]
APPROVE = ["view", "create", "edit", "approve", "export"]
EDIT = ["view", "create", "edit", "export"]

# code, name, scope, actions, screens (from the template's role permissions)
ROLES = [
    ("PRINCIPAL", "Principal", "college", APPROVE,
     ["dashboard", "admin-app", "timetable", "students", "admissions", "reports", "certificates", "expenses",
      "scholarships", "hostels", "notifications", "staff"]),
    ("ACCOUNTS-MANAGER", "Accounts Manager", "college", APPROVE,
     ["dashboard", "admin-app", "fees", "fee-structures", "payments", "receipts", "cashbook", "expenses",
      "invoices", "scholarships", "reports", "notifications"]),
    ("ADMISSION-OFFICER", "Admission Officer", "college", APPROVE,
     ["dashboard", "admissions", "students", "notifications"]),
    ("CERTIFICATE-OFFICER", "Certificate Officer", "college", APPROVE,
     ["dashboard", "certificates", "certificate-requests", "notifications"]),
    ("HOSTEL-WARDEN", "Hostel Warden", "college", APPROVE,
     ["dashboard", "hostels", "hostel-permissions", "notifications"]),
    ("FACULTY", "Faculty", "teaching", EDIT,
     ["dashboard", "academics", "students", "notifications", "teacher-app", "assignments", "assessments",
      "attendance", "timetable"]),
    ("STUDENT", "Student", "self", ["view"],
     ["student-app", "timetable", "dashboard", "fees", "payments", "receipts", "certificates",
      "hostel-permissions", "notifications"]),
    ("PARENT", "Parent", "self", ["view"], ["dashboard", "parent-app", "timetable"]),
    ("HR-MANAGER", "HR Manager", "college", APPROVE,
     ["dashboard", "employees", "employee-attendance", "employee-leave", "salary-structures", "payroll",
      "payslips", "bonuses", "reimbursements", "payroll-reports"]),
    ("PAYROLL-OFFICER", "Payroll Officer", "college", APPROVE,
     ["dashboard", "payroll", "payslips", "payroll-reports"]),
    ("PROCUREMENT-OFFICER", "Procurement Officer", "college", APPROVE,
     ["dashboard", "expense-dashboard", "purchase-requests", "purchase-orders", "vendors", "inventory", "assets"]),
    ("INVENTORY-MANAGER", "Inventory Manager", "college", EDIT,
     ["dashboard", "inventory", "assets", "purchase-orders", "vendors", "purchase-requests"]),
    ("TRANSPORT-MANAGER", "Transport Manager", "college", APPROVE, ["dashboard", *TRANSPORT]),
    ("DRIVER", "Driver", "college", ["view", "create", "edit"],
     ["dashboard", "trips", "manifest", "transport-attendance"]),
]


# Overview screens show what the role's other permissions allow; they grant no table access.
OVERVIEW_SCREENS = {"dashboard"}


def permissions_for(screens, actions, scope):
    if scope != "college":
        return {}  # student, parent and teaching access is scoped to the person, not to tables
    tables = {t for key in screens if key not in OVERVIEW_SCREENS
              for t in SCREENS[key]["resources"] if t in CATALOG}
    # "reports: view" lets screens without tables of their own (the dashboard) open.
    return {"reports": ["view"], **{t: list(actions) for t in sorted(tables)}}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="restore the template allocation of these roles")
    args = parser.parse_args()
    store = store_for(Settings())
    created = updated = 0
    with store.transaction() as data:
        admin = next((r for r in data["roles"].values() if r.get("system_admin")), None)
        if admin is None:
            data["roles"]["SYSTEM-ADMIN"] = {"code": "SYSTEM-ADMIN", "name": "Super Admin",
                                             "permissions": {}, "system_admin": True}
            created += 1
        elif admin["name"] != "Super Admin" and not any(
            r["name"] == "Super Admin" for r in data["roles"].values()
        ):
            admin["name"] = "Super Admin"
            updated += 1
        for code, name, scope, actions, screens in ROLES:
            missing = [s for s in screens if s not in SCREENS]
            assert not missing, (code, missing)
            values = {"code": code, "name": name, "scope": scope, "system_admin": False,
                      "permissions": permissions_for(screens, actions, scope), "screens": screens}
            role = data["roles"].get(code)
            if role is None:
                if any(r["name"].casefold() == name.casefold() for r in data["roles"].values()):
                    print(f"Skipped {name}: another role already uses the name")
                    continue
                data["roles"][code] = values
                audit(data, "system", "create", "roles", code)
                created += 1
            elif args.reset:
                role.update(values)
                audit(data, "system", "edit", "roles", code)
                updated += 1
    if hasattr(store, "close"):
        store.close()
    print(f"Roles created: {created}, reset: {updated}; {len(ROLES) + 1} template roles in total")


if __name__ == "__main__":
    main()
