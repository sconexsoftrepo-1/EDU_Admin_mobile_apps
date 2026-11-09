"""Proof timestamps in the SQL store, checked against the SQL it sends (no database needed)."""
from types import SimpleNamespace

from app.core.sql_store import _ABSENT, Column, Session, Table, TableView


class Cursor:
    def __init__(self):
        self.sql = []

    def execute(self, query, params=()):
        self.sql.append((query, params))


def table(name, *cols):
    t = Table(name)
    for col, kind in cols:
        t.columns[col] = Column(col, kind, True, False)
    t.visible = set(t.columns)
    return t


def session(dialect="sqlserver"):
    s = Session.__new__(Session)
    students = table("students", ("code", "text"), ("first_name", "text"), ("created_at", "timestamptz"),
                     ("updated_at", "timestamptz"))
    s.meta = SimpleNamespace(tables={"students": students}, dialect=dialect)
    return s


def test_every_edit_stamps_updated_at_with_the_database_time():
    s, cur = session(), Cursor()
    s._update(cur, "students", "STU-0001", {"first_name": "Asha"}, {}, False)
    query, params = cur.sql[0]
    assert query == "UPDATE students SET first_name = %s, updated_at = SYSDATETIMEOFFSET() WHERE code = %s"
    assert params == ("Asha", "STU-0001")
    # A change kept in the extras table still marks the row as edited.
    cur = Cursor()
    s._update(cur, "students", "STU-0001", {}, {"note": "x"}, True)
    assert cur.sql[0][0] == "UPDATE students SET updated_at = SYSDATETIMEOFFSET() WHERE code = %s"
    cur = Cursor()
    session("postgres")._update(cur, "students", "STU-0001", {"first_name": "Asha"}, {}, False)
    assert cur.sql[0][0].endswith("updated_at = now() WHERE code = %s")


def test_deleted_records_are_kept_in_the_audit_log():
    s = session()
    view = TableView(s, s.meta.tables["students"])
    view.orig = {"STU-0001": {"code": "STU-0001", "first_name": "Asha"}, "STU-0002": _ABSENT}
    view.rows = {}
    log = SimpleNamespace(new=[{"actor": "USR-1", "action": "delete"}])
    log.append = log.new.append
    s.tables = {"students": view, "audit_logs": TableView(s, table("audit_logs"))}
    s.parts = {"audit": log}
    s.part = lambda key: s.parts[key]
    s.audit_deletes()
    entry = log.new[-1]
    assert (entry["action"], entry["resource"], entry["entity_code"], entry["actor"]) == \
        ("record_deleted", "students", "STU-0001", "USR-1")
    assert entry["before_data"] == {"code": "STU-0001", "first_name": "Asha"} and entry["occurred_at"]
    assert len(log.new) == 2  # nothing for a row that never existed
