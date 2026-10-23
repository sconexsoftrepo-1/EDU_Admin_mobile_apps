"""Create the EduNexa schema on an empty PostgreSQL database (or an empty schema in it).

Runs ../database/edunexa_schema_postgresql.sql (the complete schema, versions 001-008) inside one
transaction, so any failure leaves nothing behind, and records those versions in
schema_migrations. Later changes are applied incrementally with tools/migrate.py. Use --dry-run
to apply and roll back.
"""

import argparse
import re
import sys
from pathlib import Path

from psycopg import sql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.database import SCHEMA_FILE, DatabaseSettings, connect, sha256

# Schema versions contained in the schema file (its "BEGIN EDUNEXA Vn" sections).
INCLUDED_VERSIONS = ["001", "002", "003", "004", "005", "006", "007", "008"]
MIGRATIONS_TABLE = """
CREATE TABLE schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  source_file VARCHAR(255) NOT NULL,
  source_sha256 CHAR(64) NOT NULL,
  applied_file VARCHAR(255) NOT NULL,
  applied_sha256 CHAR(64) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY"""
COUNTS = (
    "SELECT (SELECT COUNT(*) FROM pg_tables WHERE schemaname = %(s)s),"
    " (SELECT COUNT(*) FROM pg_views WHERE schemaname = %(s)s),"
    " (SELECT COUNT(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid"
    "   WHERE c.relnamespace = %(s)s::regnamespace AND NOT tg.tgisinternal),"
    " (SELECT COUNT(*) FROM pg_constraint WHERE connamespace = %(s)s::regnamespace AND contype = 'f'),"
    " (SELECT COUNT(*) FROM pg_constraint WHERE connamespace = %(s)s::regnamespace AND contype = 'c')"
)


def script(path: Path) -> str:
    """A migration file's statements without its own BEGIN/COMMIT (the caller owns the transaction)."""
    return re.sub(r"^\s*(BEGIN|COMMIT);\s*$", "", path.read_text(), flags=re.M | re.I)


def install(conn, schema):
    """Create every object in `schema` on the open connection; the caller commits or rolls back."""
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM pg_tables WHERE schemaname = %s", (schema,))
    existing = cur.fetchone()[0]
    if existing:
        raise SystemExit(f"{existing} tables already exist in schema {schema}; use tools/migrate.py")
    cur.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier(schema)))
    cur.execute(sql.SQL("SET LOCAL search_path TO {}").format(sql.Identifier(schema)))
    try:
        cur.execute(script(SCHEMA_FILE))
    except Exception as exc:
        raise SystemExit(f"{SCHEMA_FILE.name} failed: {exc}") from None
    cur.execute(MIGRATIONS_TABLE)
    applied = sha256(SCHEMA_FILE)
    for version in INCLUDED_VERSIONS:
        cur.execute(
            "INSERT INTO schema_migrations (version, source_file, source_sha256, applied_file, applied_sha256)"
            " VALUES (%s, %s, %s, %s, %s)",
            (version, SCHEMA_FILE.name, applied, SCHEMA_FILE.name, applied),
        )
    cur.execute(COUNTS, {"s": schema})
    return cur.fetchone()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="apply, report, then roll back")
    parser.add_argument("--schema", help="target schema (default EDUNEXA_DB_SCHEMA or public)")
    args = parser.parse_args()
    settings = DatabaseSettings()
    schema = args.schema or settings.db_schema

    conn = connect(settings, schema)
    try:
        tables, views, triggers, fks, checks = install(conn, schema)
    except BaseException:
        conn.rollback()
        conn.close()
        print("Rolled back; database left unchanged.", file=sys.stderr)
        raise
    if args.dry_run:
        conn.rollback()
    else:
        conn.commit()
    conn.close()
    action = "Dry run rolled back" if args.dry_run else "Schema applied"
    print(f"{action} in schema {schema}: {tables} tables, {views} views, {triggers} triggers, "
          f"{fks} foreign keys, {checks} check constraints from {SCHEMA_FILE.name}")


if __name__ == "__main__":
    main()
