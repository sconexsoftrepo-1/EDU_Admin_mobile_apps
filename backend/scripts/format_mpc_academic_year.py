"""Migrate the existing MPC calendar and its links; run with --apply to commit.

The dry run is the default. A private recovery manifest is written before changes.
All database changes commit together, without disabling foreign key constraints.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from app.core.resources import CATALOG
from app.core.sqlserver import SqlServerStore
from app.core.storage import audit
from app.modules.academics.academic_years.service import course_year_identity


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    store = SqlServerStore()
    with store.transaction() as data:
        years = data["records"]["academic_years"]
        old_code = "TEST"
        if old_code not in years:
            migrated = years.get("INT-MPC-2026-2028")
            if migrated and migrated.get("program_code") == "INT-MPC":
                print("MPC academic year is already formatted: INT-MPC-2026-2028")
                return
            raise RuntimeError("Expected MPC academic year was not found")
        old = dict(years[old_code])
        if (old["name"], old["start_date"], old["end_date"]) != (
            "MPC 2026 - 2028", "2026-10-01", "2028-10-24"
        ):
            raise RuntimeError("MPC dates or name changed; review before migrating")
        program = data["records"]["programs"]["INT-MPC"]
        code, name = course_year_identity(program, old["start_date"], old["end_date"])
        if code in years:
            raise RuntimeError("The generated academic year already exists")
        references = set()
        for table in data.meta.tables.values():
            references.update((table.name, column) for column, parent, _ in table.fks
                              if parent == "academic_years")
        for table, schema in CATALOG.items():
            references.update((table, field["name"]) for field in schema["fields"]
                              if field.get("reference") == "academic_years")
        linked = []
        for table, column in sorted(references):
            for row in data["records"].get(table, {}).values():
                if row.get(column) == old_code:
                    if row.get("program_code") not in (None, "", "INT-MPC"):
                        raise RuntimeError(f"Another course references the MPC calendar in {table}")
                    linked.append((table, column, row))
        forms = {row["code"] for row in data["forms"].values()
                 if row.get("screen") == "academic_years"}
        submissions = [row for row in data["submissions"].values()
                       if row.get("form_code") in forms and row.get("entity_code") == old_code]
        report = {"old_code": old_code, "new_code": code, "new_name": name,
                  "linked_records": len(linked), "form_submissions": len(submissions),
                  "applied": args.apply}
        if args.apply:
            folder = Path(".migration-target")
            folder.mkdir(exist_ok=True)
            backup = folder / ("mpc-year-before-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ".json")
            manifest = {**report, "original": old,
                        "references": [{"table": t, "column": c, "code": r["code"]} for t, c, r in linked],
                        "submission_codes": [row["code"] for row in submissions]}
            with backup.open("x", encoding="utf-8") as output:
                backup.chmod(0o600)
                json.dump(manifest, output, indent=2, default=str)
            # Flush in dependency order inside the same transaction: new parent,
            # children repointed, then old parent removed.
            years[code] = {**old, "code": code, "name": name, "program_code": program["code"]}
            data.sync()
            for _, column, row in linked:
                row[column] = code
            for row in submissions:
                row["entity_code"] = code
            data.sync()
            del years[old_code]
            audit(data, "system:academic-year-format", "rename", "academic_years", code)
        print(json.dumps(report))


if __name__ == "__main__":
    main()
