"""One-time data update for the deployed server. Run it once from the backend folder:

    .venv/bin/python tools/apply_pending_updates.py

It uses the server's own .env (database and S3), and in one database transaction:
  1. assigns active faculty to every current-semester subject and lab that has no faculty yet
     (same rules as tools/assign_faculty.py: matching specialization first, then lightest load),
     linking each section's students to the new subject offering;
  2. adds this month's demo data for the linked demo batches (attendance for past class days, an
     assessment, an assignment and calendar events), as tools/seed_demo_month.py does.
Existing records are never changed; running it again adds nothing new.

It prints what it did, and after a successful run it deletes this file so it cannot be run twice
by accident. If anything fails, nothing is saved and the file is kept so it can be run again.
"""
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))
sys.path.insert(0, str(HERE.parent))

from app.core.settings import Settings  # noqa: E402
from app.core.storage import audit  # noqa: E402
from create_master_data_role import store_for  # noqa: E402

IST = ZoneInfo("Asia/Kolkata")


def main():
    import assign_faculty
    store = store_for(Settings())
    report = {}
    try:
        today = datetime.now(IST).date()
        with store.transaction() as data:
            # 1. Faculty for subjects and labs.
            rows = assign_faculty.plan(data)
            assign_faculty.apply(data, rows)
            report["faculty"] = rows
            # 2. This month's demo data (only when the linked demo batches exist).
            try:
                from seed_demo_month import plan_month
                from app.core.academic_progress import local_now  # noqa: F401  (timezone setup)
                from app.modules.academics.calendar_events.api import query_save
                added, events = plan_month(data, today.year, today.month, today)
                for key, values in added.items():
                    data["documents"][key].update(values)
                for event in events:
                    query_save(data, event)
                report["demo_month"] = {**{k: len(v) for k, v in added.items()}, "calendar_events": len(events)}
            except ImportError as exc:
                report["demo_month"] = f"skipped ({exc})"
            audit(data, None, "pending_updates_applied", "subject_offerings", today.isoformat())
        # Confirm: nothing is left to assign.
        remaining = assign_faculty.plan(store.snapshot())
    finally:
        if hasattr(store, "close"):
            store.close()

    rows = report["faculty"]
    print(f"Faculty assigned to {len(rows)} subject(s) and lab(s):")
    for r in rows:
        print(f"  {r['academic_year_name'] or r['academic_year_code']:<14} Section {r['section_name']:<4} "
              f"{r['subject_name']:<40} -> {r['teacher_name']}{'' if r['matched'] else '  (by load)'}")
    print(f"Subjects still without faculty: {len(remaining)}")
    print(f"Demo data for {today:%B %Y}: {report['demo_month']}")
    HERE.unlink()
    print(f"Done. {HERE.name} has been deleted.")


if __name__ == "__main__":
    main()
