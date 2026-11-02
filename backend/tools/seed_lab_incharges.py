"""One-time: add demo lab in-charges, their labs and their staff-app logins. Run once on the server
from the backend folder (it uses the server's own .env):

    .venv/bin/python tools/seed_lab_incharges.py

For each linked demo course it creates, in one database transaction:
  * a non-teaching employee with the designation "Lab in-charge" (D26-LAB01 … D26-LAB04),
  * a registered lab (name, floor, room number, type) linked to that course's practical subjects,
    with the new employee as lab in-charge,
  * a login (demo.lab01 … demo.lab04, password test@123) for the staff app with the
    "Lab In-charge" role: lab sessions, lab timetable, leave, payslips and Form 16.
Faculty assigned to those practical subjects keep supervising the students.

Nothing existing is changed. When the logins already exist it adds nothing. After a successful run
it deletes this file; if anything fails nothing is saved and the file is kept.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))
sys.path.insert(0, str(HERE.parent))

from app.core.lab_workspace import LAB_ROLE, ensure_lab_role, lab_subject, registry  # noqa: E402
from app.core.resources import CATALOG, ensure_references, validate_record  # noqa: E402
from app.core.security import hasher  # noqa: E402
from app.core.settings import Settings  # noqa: E402
from app.core.storage import audit, now  # noqa: E402
from create_master_data_role import store_for  # noqa: E402

PASSWORD = "test@123"
RUN = "lab-incharges-2026-v1"
# (course, in-charge first name, last name, lab name, lab type, floor, room)
LABS = [
    ("Intermediate BPC", "Lakshmi", "Prasad", "Biology Lab", "Biology", "Ground", "G-04"),
    ("Intermediate MPC", "Suresh", "Kumar", "Physics & Chemistry Lab", "Physics", "1st", "104"),
    ("BCA", "Farhan", "Ali", "Computer Lab", "Computer", "2nd", "201"),
    ("B.Com General", "Divya", "Menon", "Commerce Practice Lab", "Commerce", "2nd", "204"),
]


def plan_and_apply(data):
    """Create what is missing; return the created logins (empty when already done)."""
    records = data["records"]
    accounts = data["accounts"]
    logins = {a["login_id"].casefold() for a in accounts.values()}
    curricula = data.get("documents", {}).get("academic_batch_curricula", {})
    created = []
    ensure_lab_role(data)
    for i, (course, first, last, lab_name, lab_type, floor, room) in enumerate(LABS, 1):
        login = f"demo.lab{i:02d}"
        if login in logins:
            continue
        program = next((p for p in records.get("programs", {}).values() if p["name"].casefold() == course.casefold()), None)
        if not program:
            continue
        year = next((y for y in records.get("academic_years", {}).values()
                     if y.get("program_code") == program["code"] and str(y["code"]).startswith("D26-")), None)
        plan = curricula.get(year["code"], {}) if year else {}
        subjects = sorted({item["subject_code"] for item in plan.get("items", []) if lab_subject(item)})
        if not subjects:
            subjects = sorted(s["code"] for s in records.get("subjects", {}).values() if lab_subject(s)
                              and any(c.get("program_code") == program["code"] and c.get("subject_code") == s["code"]
                                      for c in records.get("curriculum_subjects", {}).values()))
        department = records.get("departments", {}).get(program.get("department_code"), {})
        employee_code = f"D26-LAB{i:02d}"
        values = {"code": employee_code, "campus_code": department.get("campus_code"), "department_code": department.get("code"),
                  "first_name": first, "last_name": last, "employee_type": "staff", "designation": "Lab in-charge",
                  "join_date": "2024-06-01", "employment_type": "permanent", "status": "active",
                  "email": f"{login}@example.invalid"}
        fields = {f["name"] for f in CATALOG["employees"]["fields"]}
        employee = validate_record("employees", {k: v for k, v in values.items() if k in fields})
        employee["demo_run"] = RUN
        ensure_references(data, "employees", employee)
        records.setdefault("employees", {})[employee_code] = employee
        lab_code = f"D26-LABROOM{i:02d}"
        registry(data)[lab_code] = {"code": lab_code, "name": f"{lab_name} ({course})", "floor": floor, "room_number": room,
                                    "lab_type": lab_type, "incharge_employee_code": employee_code, "subject_codes": subjects,
                                    "campus_code": department.get("campus_code"), "capacity": 30, "status": "active",
                                    "revision": 1, "created_at": now(), "updated_at": now(), "created_by": None, "demo_run": RUN}
        account_code = f"D26-LABACC{i:02d}"
        accounts[account_code] = {"code": account_code, "login_id": login, "password_hash": hasher.hash(PASSWORD),
                                  "active": True, "person_type": "employee", "person_code": employee_code,
                                  "role_codes": [LAB_ROLE], "clients": ["teacher-mobile"], "demo_run": RUN}
        logins.add(login)
        audit(data, None, "lab_incharge_demo", "labs", lab_code)
        created.append({"login": login, "name": f"{first} {last}", "course": course,
                        "lab": f"{lab_name} ({course})", "room": f"{floor} floor · Room {room}", "subjects": len(subjects)})
    return created


def main():
    store = store_for(Settings())
    try:
        with store.transaction() as data:
            created = plan_and_apply(data)
    finally:
        if hasattr(store, "close"):
            store.close()
    if created:
        print(f"Created {len(created)} lab in-charge login(s) (password {PASSWORD}, Staff app):")
        for c in created:
            print(f"  {c['login']:<12} {c['name']:<16} {c['lab']:<40} {c['room']:<24} {c['subjects']} lab subject(s)")
    else:
        print("Nothing to add: the demo lab in-charges already exist (or the demo courses are missing).")
    HERE.unlink()
    print(f"Done. {HERE.name} has been deleted.")


if __name__ == "__main__":
    main()
