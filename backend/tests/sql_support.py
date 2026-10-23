"""Running the suite against PostgreSQL (EDUNEXA_TEST_STORAGE=postgres).

Tests get a private copy of the schema in its own PostgreSQL schema, emptied before each test.
Fixture records written directly by test code are deliberately partial (they bypass API input
requirements), so before those writes are flushed, ``complete`` fills NOT NULL columns with
placeholder values and creates stub parent rows for missing references. Writes made by the
application itself are never completed, so its records must satisfy the real schema.
"""

import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from app.core.database import DatabaseSettings, connect
from app.core.sql_store import TableView, _ABSENT

TESTS = str(Path(__file__).resolve().parent)
ENABLED = os.environ.get("EDUNEXA_TEST_STORAGE") == "postgres"
SCHEMA = f"edunexa_test_{os.getpid()}"
PREFERRED = ["active", "draft", "pending", "scheduled", "available", "internal", "regular", "open",
             "cash", "settled", "issued", "present", "theory", "full_time", "college", "web", "other"]


def _run(*statements, params=None):
    conn = connect(schema=SCHEMA)
    try:
        cur = conn.cursor()
        for statement in statements:
            cur.execute(statement, params)
        rows = cur.fetchall() if cur.description else None
        conn.commit()
        return rows
    finally:
        conn.close()


def install():
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
    from apply_schema import install as apply

    conn = connect(schema=SCHEMA)
    try:
        apply(conn, SCHEMA)
        conn.commit()
    finally:
        conn.close()


def drop():
    _run(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE")


def wipe(meta):
    """Empty every table; TRUNCATE skips the append-only row triggers and reference cycles."""
    _run("TRUNCATE " + ", ".join(meta.order) + " RESTART IDENTITY")


class Rules:
    """Column defaults, enums and single-column unique keys, read once from the test schema."""

    def __init__(self):
        self.defaults = set(map(tuple, _run(
            "SELECT table_name, column_name FROM information_schema.columns"
            " WHERE table_schema = %(s)s AND column_default IS NOT NULL", params={"s": SCHEMA})))
        self.enums = {}
        for t, d in _run("SELECT conrelid::regclass::text, pg_get_constraintdef(oid) FROM pg_constraint"
                         " WHERE connamespace = %(s)s::regnamespace AND contype = 'c'", params={"s": SCHEMA}):
            m = re.fullmatch(r"CHECK \(\((\w+) = ANY \(ARRAY\[(.*)\]\)\)\)", d)
            if m:
                self.enums[(t.rsplit(".", 1)[-1], m.group(1))] = re.findall(r"'([^']*)'::\w+", m.group(2))
        self.unique = set(map(tuple, _run(
            "SELECT c.relname, a.attname FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid"
            " JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]"
            " WHERE c.relnamespace = %(s)s::regnamespace AND i.indisunique AND i.indnatts = 1", params={"s": SCHEMA})))


_rules = None


def placeholder(rules, table, col, code):
    name = col.name
    if (table, name) in rules.enums:
        values = rules.enums[(table, name)]
        return next((v for v in PREFERRED if v in values), values[-1])
    ty = col.type
    end = any(k in name for k in ("end", "_to", "until", "closes", "return", "due", "expires", "graduation", "accept_by"))
    if col.json:
        return {}
    if col.array:
        return []
    if ty in {"varchar", "text", "bpchar"}:
        if "sha256" in name or name == "token_hash":
            return "0" * 64
        if (table, name) in rules.unique or name.endswith("number") or name == "email":
            return f"{name}-{code}"
        return "x"
    if ty in {"int2", "int4", "int8"}:
        return 2030 if "year" in name else 1
    if ty == "numeric":
        return "100.00" if "max" in name else "0.00"
    if ty == "date":
        return "2026-12-31" if end else "2026-01-01"
    if ty == "time":
        return "10:00" if end else "09:00"
    if ty == "timestamptz":
        return ("2026-12-31T00:00:00+00:00" if end else datetime.now(timezone.utc).isoformat())
    if ty == "bool":
        return False
    return "x"


def complete(session):
    """Fill required columns of fixture rows and create stub parents for dangling references."""
    global _rules
    _rules = _rules or Rules()
    meta = session.meta
    for key in ("accounts", "roles", "sessions", "forms", "submissions", "audit"):
        if key in session.parts:
            session.parts[key].push()  # translated rows must exist before references are checked
    pending = [(name, code) for name, view in list(session.tables.items()) if isinstance(view, TableView)
               for code in list(view.rows)]
    seen = set()
    while pending:
        name, code = pending.pop()
        if (name, code) in seen:
            continue
        seen.add((name, code))
        t = meta.tables[name]
        view = session.table(name)
        record = view.rows[code]
        record.setdefault("code", code)
        before = view.orig.get(code, _ABSENT)
        if before is not _ABSENT:  # replaced fixture rows keep the values they already had
            for k, v in before.items():
                record.setdefault(k, v)
        for col in t.columns.values():
            if col.identity or col.nullable or (name, col.name) in _rules.defaults or record.get(col.name) is not None:
                continue
            record[col.name] = placeholder(_rules, name, col, code)
        for c, parent, pc in t.fks:
            value = record.get(c)
            if value is None or pc != "code":
                continue
            target = session.table(parent)
            if value not in target:
                target[value] = {"code": value}
                pending.append((parent, value))


def caller_is_test(depth=2):
    return sys._getframe(depth).f_code.co_filename.startswith(TESTS)


def settings_env():
    os.environ["EDUNEXA_DB_SCHEMA"] = SCHEMA
    return DatabaseSettings()
