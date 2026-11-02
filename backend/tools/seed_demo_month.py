"""Extend the linked academic demo (tools/seed_linked_academics.py) with one month of dated data.

For each demo batch it adds, for the chosen month:
  * attendance registers for every class day (Mon–Sat) up to today — never future days,
  * an assessment and an assignment scheduled inside the month,
  * college calendar events (exhibition, mid-semester assessments, parent–teacher meeting,
    semester close).
Records are copied from the batch's existing demo records, carry stable codes and are skipped
when already present, so running it twice changes nothing. Only demo (D26-) data is touched.

    python tools/seed_demo_month.py --month 2026-11            # dry run: report only
    python tools/seed_demo_month.py --month 2026-11 --apply    # write
"""
import argparse
import calendar
import copy
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.settings import Settings
from app.core.storage import audit, now
from create_master_data_role import store_for
from seed_linked_academics import PREFIX, RUN

IST = ZoneInfo("Asia/Kolkata")


def plan_month(data, year, month, today):
    """Return {document_key: {code: record}} and calendar event records to add."""
    documents = data.setdefault("documents", {})
    registers = documents.setdefault("attendance_registers", {})
    assessments = documents.setdefault("assessments", {})
    assignments = documents.setdefault("assignment_records", {})
    tag = f"{year}{month:02d}"
    days = [date(year, month, d) for d in range(1, calendar.monthrange(year, month)[1] + 1)]
    added = {"attendance_registers": {}, "assessments": {}, "assignment_records": {}}

    demo_registers = [r for r in registers.values() if r.get("demo_run") == RUN]
    for section in sorted({r["section_code"] for r in demo_registers}):
        mine = [r for r in demo_registers if r["section_code"] == section]
        # Attendance: copy the same weekday's demo classes onto each past class day of the month.
        for day in days:
            if day > today or day.isoweekday() == 7:
                continue
            for template in [r for r in mine if date.fromisoformat(r["session_date"]).isoweekday() == day.isoweekday()]:
                code = f"{section}-ATT{tag}-{day.day:02d}-{template['period']}"
                if code in registers:
                    continue
                students = sorted(template["marks"])
                record = {**copy.deepcopy(template), "code": code, "session_date": day.isoformat(), "updated_at": now(),
                          "marks": {s: "absent" if (i + day.day + template["period"]) % 13 == 0
                                    else "late" if (i + day.day) % 17 == 0 else "present"
                                    for i, s in enumerate(students)}}
                added["attendance_registers"][code] = record

        # Assessment and assignment inside the month, copied from the batch's upcoming demo work.
        for source, target, kind in ((assessments, "assessments", "ASSESS"), (assignments, "assignment_records", "ASG")):
            template = next((r for r in source.values() if r.get("section_code") == section
                             and r["code"].startswith(PREFIX) and r["code"].endswith("-NEXT")), None)
            if template is None:
                continue
            code = f"{template['code'][:-5]}-{tag}"
            if code in source:
                continue
            when = datetime.combine(date(year, month, 12 if kind == "ASSESS" else 20), time(10, 0), IST)
            record = {**copy.deepcopy(template), "code": code, "revision": 1, "updated_at": now()}
            label = calendar.month_name[month]
            if kind == "ASSESS":
                record.update(title=template["title"].split(" · ")[0] + f" · {label} assessment",
                              scheduled_at=when.isoformat(), status="published")
            else:
                record.update(title=template["title"].split(" · ")[0] + f" · {label} worksheet", due_at=when.isoformat())
            added[target][code] = record

    # College calendar events for the month (one set, visible to everyone).
    events = []
    existing = {r["code"] for r in data["records"].get("calendar_events", {}).values()}
    campus = next(iter(sorted(data["records"].get("campuses", {}))), None)
    for day, until, title, kind, place, summary in (
        (6, 6, "Science exhibition", "academic", "Main hall", "Student projects and lab demonstrations."),
        (10, 14, "Mid-semester assessments", "academic", "Classrooms", "Internal assessments for all current semesters."),
        (21, 21, "Parent–teacher meeting", "meeting", "Seminar hall", "Discuss progress with subject teachers."),
        (30, 30, "Semester close", "academic", "College", "Last instructional day of the odd semester."),
    ):
        if day > len(days):
            continue
        code = f"{PREFIX}EVT{tag}-{day:02d}"
        if code in existing or not campus:
            continue
        starts = datetime.combine(date(year, month, day), time(10, 0), IST)
        ends = datetime.combine(date(year, month, until), time(16, 0), IST)
        events.append({"code": code, "campus_code": campus, "title": title, "starts_at": starts.isoformat(),
                       "ends_at": ends.isoformat(), "event_type": kind, "place": place,
                       "short_description": summary, "description": summary + " Demo event.",
                       "audience_type": "all", "audience_code": None, "image_code": None,
                       "created_by": None, "created_at": now()})
    return added, events


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--month", required=True, help="YYYY-MM, e.g. 2026-11")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    year, month = (int(part) for part in args.month.split("-"))
    today = datetime.now(IST).date()
    store = store_for(Settings())
    try:
        if not args.apply:
            added, events = plan_month(store.snapshot(), year, month, today)
            print(f"Dry run for {args.month} (attendance up to {today}):")
            for key, rows in added.items():
                print(f"  {key}: {len(rows)} to add")
            print(f"  calendar_events: {len(events)} to add")
            print("Re-run with --apply to write.")
            return
        with store.transaction() as data:
            added, events = plan_month(data, year, month, today)
            for key, rows in added.items():
                data["documents"][key].update(rows)
            from app.modules.academics.calendar_events.api import query_save
            for event in events:
                query_save(data, event)
            audit(data, None, "demo_month_seed", "academic_years", f"{RUN}:{args.month}")
        print(f"Added for {args.month}: " + ", ".join(f"{k} {len(v)}" for k, v in added.items()) + f", calendar_events {len(events)}")
    finally:
        if hasattr(store, "close"):
            store.close()


if __name__ == "__main__":
    main()
