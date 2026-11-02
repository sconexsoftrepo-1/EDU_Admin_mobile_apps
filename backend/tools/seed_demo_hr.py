"""One-time: demo HR & payroll data for the demo staff. Run once on the server from the backend
folder (it uses the server's own .env, database and S3 bucket):

    .venv\\Scripts\\python.exe tools\\seed_demo_hr.py      (Windows)
    .venv/bin/python tools/seed_demo_hr.py                (macOS / Linux)

For every active demo employee (code D26-…), in one database transaction:
  * leave types "Paid leave" (12 days a year) and "Sick leave" (8 days a year);
  * a salary structure (Basic, HRA, Special allowance, Conveyance; Provident fund, Professional tax,
    TDS) sized by role, when the employee has none;
  * leave history for this year — approved paid and sick leave, one pending and one rejected request;
  * daily attendance for last month and this month so far (present / half day / absent / leave /
    holidays), with check-in and check-out times;
  * bonuses and incentives (festival bonus, performance and exam-duty incentives, travel
    reimbursement) paid through the monthly payroll;
  * payroll for every month from April 2025 to last month, published and marked paid, so each
    payslip has a salary payment receipt;
  * Form 16 (Part B) for financial year 2025-2026, stored in S3 with their documents.

Nothing that already exists is changed or duplicated; running it again adds only what is missing.
After a successful run this file deletes itself; if anything fails nothing is saved and it is kept.
"""
import sys
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))
sys.path.insert(0, str(HERE.parent))

from app.core.files import files_for  # noqa: E402
from app.core.hr_workspace import add_adjustment, working_days  # noqa: E402
from app.core.payroll_workspace import PUBLISHED, issue_form16, mark_paid, run_payroll  # noqa: E402
from app.core.settings import Settings  # noqa: E402
from app.core.storage import audit, new_code, now  # noqa: E402
from create_master_data_role import store_for  # noqa: E402

FIRST_MONTH = date(2025, 4, 1)
FORM16_YEAR = "2025-2026"
RUN = "demo-hr-2026-v1"
HOLIDAYS = {"2026-10-02": "Gandhi Jayanti", "2026-10-20": "Dussehra"}
SCALES = {
    "senior": {"Basic pay": 48000, "House rent allowance": 19200, "Special allowance": 9000, "Conveyance allowance": 1600,
               "Provident fund": 5760, "Professional tax": 200, "TDS (income tax)": 4200},
    "lecturer": {"Basic pay": 36000, "House rent allowance": 14400, "Special allowance": 6000, "Conveyance allowance": 1600,
                 "Provident fund": 4320, "Professional tax": 200, "TDS (income tax)": 1800},
    "staff": {"Basic pay": 22000, "House rent allowance": 8800, "Special allowance": 3000, "Conveyance allowance": 1600,
              "Provident fund": 2640, "Professional tax": 200},
}
DEDUCTIONS = {"Provident fund", "Professional tax", "TDS (income tax)"}
LEAVE_TYPES = [("PAID-LEAVE", "Paid leave", 12), ("SICK-LEAVE", "Sick leave", 8)]


def scale(employee):
    title = f"{employee.get('designation') or ''}".casefold()
    if any(w in title for w in ("principal", "admin", "director", "head", "hod", "dean")):
        return "senior"
    if employee.get("employee_type") == "teacher" or any(w in title for w in ("lecturer", "professor", "teacher", "faculty")):
        return "lecturer"
    return "staff"


def months(until):
    current = FIRST_MONTH
    while current < until:
        yield current.strftime("%Y-%m")
        current = date(current.year + (current.month == 12), current.month % 12 + 1, 1)


def nth_workday(year, month, n):
    days = [d for d in working_days(date(year, month, 1), date(year, month, 28)) if d.isoformat() not in HOLIDAYS]
    return days[min(n, len(days) - 1)]


def leave_types(data):
    table = data["records"].setdefault("leave_types", {})
    codes = {}
    for code, name, days in LEAVE_TYPES:
        existing = next((t for t in table.values() if str(t.get("name", "")).casefold() == name.casefold()), None)
        if existing:
            existing["annual_days"] = days
            codes[name] = existing["code"]
        else:
            table[code] = {"code": code, "name": name, "annual_days": days, "demo_run": RUN}
            codes[name] = code
    return codes


def structures(data, employees):
    records = data["records"]
    has = {c.get("employee_code") for c in records.get("employee_salary_components", {}).values() if not c.get("effective_to")}
    added = 0
    for i, employee in enumerate(employees):
        if employee["code"] in has:
            continue
        start = max(str(employee.get("join_date") or "")[:10] or FIRST_MONTH.isoformat(), FIRST_MONTH.isoformat())
        bump = 1 + (i % 4) * 0.03
        for component, value in SCALES[scale(employee)].items():
            figure = value if component in {"Professional tax", "Conveyance allowance"} else round(value * bump / 10) * 10
            code = new_code("SALC")
            records.setdefault("employee_salary_components", {})[code] = {
                "code": code, "employee_code": employee["code"], "component": component,
                "component_type": "deduction" if component in DEDUCTIONS else "earning",
                "amount": f"{figure:.2f}", "effective_from": start, "demo_run": RUN}
        added += 1
    return added


def leave_history(data, employees, types, approver, today):
    table = data["records"].setdefault("leave_requests", {})
    done = {r.get("employee_code") for r in table.values() if r.get("demo_run") == RUN}
    added = 0
    year = today.year
    for i, employee in enumerate(employees):
        if employee["code"] in done:
            continue
        plan = [  # (type, month, nth working day, days, status, reason)
            ("Paid leave", 1 + i % 3, 5 + i % 4, 2, "approved", "Family function"),
            ("Sick leave", 2 + i % 4, 8, 1 + i % 2, "approved", "Fever"),
            ("Paid leave", 5, 3 + i % 5, 3 if i % 2 else 2, "approved", "Summer vacation travel"),
            ("Paid leave", 8, 10 + i % 3, 1, "rejected", "Personal work — exam week"),
            ("Sick leave", 10, 12 + i % 5, 1 + (i % 3 == 0), "approved", "Medical appointment"),
            ("Paid leave", 11, 14 + i % 4, 2, "pending", "Diwali at home town"),
        ]
        for kind, month, nth, days, status, reason in plan:
            if month > today.month and status != "pending":
                continue
            start = nth_workday(year, month, nth)
            span = [d for d in working_days(start, start + timedelta(days=days + 3)) if d.isoformat() not in HOLIDAYS][:days]
            if status != "pending" and span[-1] >= today:
                continue
            code = new_code("LEAVE")
            table[code] = {"code": code, "employee_code": employee["code"], "leave_type_code": types[kind],
                           "start_date": span[0].isoformat(), "end_date": span[-1].isoformat(), "reason": reason, "status": status,
                           "approved_by_code": approver if status in {"approved", "rejected"} else None,
                           "decided_at": now() if status != "pending" else None, "requested_at": now(), "demo_run": RUN}
            added += 1
    return added


def attendance(data, employees, today):
    table = data["records"].setdefault("employee_attendance", {})
    marked = {(r.get("employee_code"), str(r.get("attendance_date"))[:10]) for r in table.values()}
    on_leave = {}
    for r in data["records"].get("leave_requests", {}).values():
        if r.get("status") == "approved":
            day = date.fromisoformat(str(r["start_date"])[:10])
            while day <= date.fromisoformat(str(r["end_date"])[:10]):
                on_leave.setdefault(r["employee_code"], set()).add(day.isoformat())
                day += timedelta(days=1)
    first = date(today.year - (today.month == 1), (today.month - 2) % 12 + 1, 1)
    added = 0
    for i, employee in enumerate(employees):
        day = first
        n = 0
        while day <= today:
            key = day.isoformat()
            if (employee["code"], key) not in marked and day.weekday() != 6:
                n += 1
                if key in HOLIDAYS:
                    status, cin, cout = "holiday", None, None
                elif key in on_leave.get(employee["code"], set()):
                    status, cin, cout = "leave", None, None
                elif (n + i * 7) % 29 == 0:
                    status, cin, cout = "absent", None, None
                elif (n + i * 5) % 17 == 0:
                    status, cin, cout = "half_day", f"08:{50 + (n + i) % 10:02d}:00", "12:45:00"
                else:
                    status, cin, cout = "present", f"08:{40 + (n * 3 + i) % 20:02d}:00", f"16:{30 + (n + i * 2) % 25:02d}:00"
                code = new_code("EATT")
                table[code] = {"code": code, "employee_code": employee["code"], "attendance_date": key, "check_in": cin,
                               "check_out": cout, "status": status, "demo_run": RUN}
                added += 1
            day += timedelta(days=1)
    return added


def bonuses(data, employees, today):
    existing = {(a.get("employee_code"), a.get("component"), a.get("demo_month")) for a in
                data["records"].get("payroll_adjustments", {}).values() if a.get("demo_run") == RUN}
    added = 0
    for i, employee in enumerate(employees):
        kind = scale(employee)
        plan = [("2025-10", "Bonus", "Festival bonus (Diwali)", {"senior": 15000, "lecturer": 10000, "staff": 6000}[kind]),
                ("2026-03", "Incentive", "Exam duty incentive", 3000 + (i % 3) * 500 if kind != "staff" else 1500),
                ("2026-07", "Incentive", "Performance incentive", (4000 + (i % 4) * 750) if kind == "lecturer" else 2500),
                ("2026-09", "Reimbursement", "Travel reimbursement (university duty)", 1200 + (i % 5) * 300),
                ("2026-10", "Bonus", "Festival bonus (Dussehra)", {"senior": 12000, "lecturer": 8000, "staff": 5000}[kind])]
        for month, category, title, value in plan:
            if month >= today.strftime("%Y-%m") or (employee["code"], title, month) in existing:
                continue
            if category == "Reimbursement" and i % 2:
                continue
            if str(employee.get("join_date") or "")[:7] > month:
                continue
            add_adjustment(data, employee["code"], month, category, title, value, None, {"demo_run": RUN, "demo_month": month})
            added += 1
    return added


def apply(data, files, keys, today):
    records = data["records"]
    employees = sorted((e for e in records.get("employees", {}).values()
                        if str(e["code"]).startswith("D26-") and e.get("status", "active") == "active"), key=lambda e: e["code"])
    if not employees:
        return None
    senior = next((e["code"] for e in employees if scale(e) == "senior"), employees[0]["code"])
    types = leave_types(data)
    report = {"structures": structures(data, employees)}
    report["leave"] = leave_history(data, employees, types, senior, today)
    report["attendance"] = attendance(data, employees, today)
    report["bonuses"] = bonuses(data, employees, today)
    published = []
    for month in months(date(today.year, today.month, 1)):
        result = run_payroll(data, month, publish=True)
        made = sum(r["payslips"] for r in result["runs"])
        if made:
            published.append((result["period"], made))
    paid = 0
    for run in records.get("payroll_runs", {}).values():
        if run.get("status") in PUBLISHED and run.get("status") != "paid":
            end = date.fromisoformat(str(run["period_end"])[:10])
            mark_paid(data, run, min(end, today))
            paid += 1
    report["payroll"], report["paid"] = published, paid
    existing = {(t.get("employee_code"), t.get("financial_year")) for t in records.get("employee_tax_documents", {}).values()
                if t.get("document_type") == "form_16"}
    issued = 0
    for employee in employees:
        if (employee["code"], FORM16_YEAR) in existing:
            continue
        try:
            key, _ = issue_form16(data, files, employee["code"], FORM16_YEAR, None, senior)
        except Exception as exc:  # no published payslips in that year (joined later)
            if getattr(exc, "status_code", None) == 409:
                continue
            raise
        keys.append(key)
        issued += 1
    report["form16"] = issued
    audit(data, None, "demo_hr_seed", "employees", RUN)
    return report


def main():
    settings = Settings()
    store, files = store_for(settings), files_for(settings)
    keys = []
    try:
        with store.transaction() as data:
            report = apply(data, files, keys, date.today())
    except Exception:
        for key in keys:
            try:
                files.delete(key)
            except Exception:
                pass
        raise
    finally:
        if hasattr(store, "close"):
            store.close()
    if report is None:
        print("No demo employees (D26-…) found; nothing was added. This file is kept.")
        return
    payroll = report["payroll"]
    print(f"Salary structures added:      {report['structures']}")
    print(f"Leave requests added:         {report['leave']}  (Paid leave 12 / Sick leave 8 per year)")
    print(f"Attendance days marked:       {report['attendance']}  (last month and this month)")
    print(f"Bonuses / incentives added:   {report['bonuses']}")
    print(f"Payroll months published:     {len(payroll)}" + (f" ({payroll[0][0]} … {payroll[-1][0]}, "
                                                             f"{sum(n for _, n in payroll)} payslips)" if payroll else ""))
    print(f"Payroll runs marked paid:     {report['paid']}  (each payslip has a salary receipt)")
    print(f"Form 16 for {FORM16_YEAR} issued: {report['form16']}")
    HERE.unlink()
    print(f"Done. {HERE.name} has been deleted.")


if __name__ == "__main__":
    main()
