"""Apply pending PostgreSQL migrations from ../database/migrations in version order.

For a schema change to an existing database, add ../database/migrations/NNN_name.sql (next
version after 010), run this tool, then fold the change into ../database/edunexa_schema_postgresql.sql
(and edunexa_schema_mysql.sql), add the version to INCLUDED_VERSIONS in tools/apply_schema.py,
and delete the migration file. Each file runs in its own transaction and is recorded in
schema_migrations with its checksum. Use --dry-run to roll back.
"""

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.database import MIGRATIONS_DIR, DatabaseSettings, connect, sha256
from apply_schema import script


def pending(cur):
    cur.execute("SELECT version, source_file, source_sha256 FROM schema_migrations")
    applied = {v: (f, h) for v, f, h in cur.fetchall()}
    todo = []
    files = sorted(MIGRATIONS_DIR.glob("[0-9][0-9][0-9]_*.sql")) if MIGRATIONS_DIR.is_dir() else []
    for path in files:
        version = path.name[:3]
        if version in applied:
            file, digest = applied[version]
            if file == f"migrations/{path.name}" and digest != sha256(path):
                raise SystemExit(f"{path.name} changed after it was applied; add a new migration instead")
            continue
        todo.append((version, path))
    return todo


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="apply pending migrations, then roll back")
    parser.add_argument("--schema", help="target schema (default EDUNEXA_DB_SCHEMA or public)")
    args = parser.parse_args()
    settings = DatabaseSettings()
    schema = args.schema or settings.db_schema

    conn = connect(settings, schema)
    try:
        cur = conn.cursor()
        todo = pending(cur)
        if not todo:
            print(f"Schema {schema} is up to date.")
            return
        for version, path in todo:
            try:
                try:
                    cur.execute(script(path))
                except Exception as exc:
                    raise SystemExit(f"{path.name} failed: {re.sub(r'\s+', ' ', str(exc))}") from None
                cur.execute(
                    "INSERT INTO schema_migrations (version, source_file, source_sha256, applied_file, applied_sha256)"
                    " VALUES (%s, %s, %s, %s, %s)",
                    (version, f"migrations/{path.name}", sha256(path), path.name, sha256(path)),
                )
            except BaseException:
                conn.rollback()
                print(f"Rolled back {path.name}; earlier migrations in this run stay applied.", file=sys.stderr)
                raise
            if args.dry_run:
                conn.rollback()
                print(f"Dry run: {path.name} applied and rolled back")
                break  # later migrations may depend on this one
            conn.commit()
            print(f"Applied {path.name}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
