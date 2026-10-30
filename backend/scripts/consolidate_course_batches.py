"""Consolidate dated course calendars and legacy cohorts. Default: read-only preview.

Run from backend: .venv/bin/python -m scripts.consolidate_course_batches [--apply]
Exact existing calendar dates and all cohort IDs are retained. Year-only cohorts
are imported with explicit provisional dates that administrators must review.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from app.main import create_app
from app.modules.academics.academic_years.api import service as calendars
from app.modules.academics.academic_years.service import course_year_identity, ensure_course_batch


def consolidate(data, actor="system:course-batch-consolidation", apply=False):
    years = list(data["records"].get("academic_years", {}).values())
    batches = list(data["records"].get("batches", {}).values())
    programs = data["records"].get("programs", {})
    report = {"linked": [], "imported": [], "dates_need_review": [], "conflicts": []}
    linked = {y.get("batch_code") for y in years if y.get("batch_code")}
    for batch in batches:
        if batch["code"] in linked:
            continue
        program = programs.get(batch["program_code"])
        if not program:
            report["conflicts"].append(batch["code"])
            continue
        start, end = int(batch["entry_year"]), int(batch["graduation_year"])
        matches = [y for y in years if y.get("program_code") == program["code"]
                   and int(str(y["start_date"])[:4]) == start and int(str(y["end_date"])[:4]) == end]
        if len(matches) > 1 or (matches and matches[0].get("batch_code") not in (None, batch["code"])):
            report["conflicts"].append(batch["code"])
            continue
        if matches:
            year = matches[0]
            report["linked"].append({"calendar": year["code"], "batch": batch["code"]})
        else:
            # Old cohorts store years only. Do not imply that invented day/month values are confirmed.
            start_date, end_date = f"{start}-01-01", f"{end}-12-31"
            code, name = course_year_identity(program, start_date, end_date)
            year = {"code": code, "name": name, "program_code": program["code"],
                    "start_date": start_date, "end_date": end_date}
            report["imported"].append({"calendar": code, "batch": batch["code"]})
            report["dates_need_review"].append(code)
            if apply:
                # Set the explicit cohort before syncing to avoid ambiguity between legacy names.
                year = calendars.create(data, year, actor)
                year["dates_need_review"] = True
                calendars.repo.save(data, year)
            years.append(year)
        if apply:
            year["batch_code"] = batch["code"]
            ensure_course_batch(data, year, actor)
            calendars.repo.save(data, year)
        linked.add(batch["code"])
    # Calendars created through the old form also become enrollment-ready cohorts.
    for year in years:
        if not year.get("program_code") or year.get("batch_code"):
            continue
        if any(c["calendar"] == year["code"] for c in report["linked"] + report["imported"]):
            continue
        if apply:
            ensure_course_batch(data, year, actor)
            calendars.repo.save(data, year)
        report["linked"].append({"calendar": year["code"], "batch": year.get("batch_code", year["code"])})
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    store = create_app().state.store
    # Check conflicts before writing; one transaction commits the complete consolidation.
    with store.transaction() as data:
        report = consolidate(data)
        if args.apply:
            if report["conflicts"]:
                raise RuntimeError("Resolve duplicate course/date matches first: " + str(report["conflicts"]))
            folder = Path(".migration-target")
            folder.mkdir(exist_ok=True)
            backup = folder / ("course-batches-before-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ".json")
            with backup.open("x") as output:
                backup.chmod(0o600)
                json.dump({"academic_years": list(data["records"].get("academic_years", {}).values()),
                           "batches": list(data["records"].get("batches", {}).values())}, output, indent=2, default=str)
            report = consolidate(data, apply=True)
        print(json.dumps({"applied": args.apply, **report}, indent=2))


if __name__ == "__main__":
    main()
