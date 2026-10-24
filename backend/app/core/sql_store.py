"""PostgreSQL persistence behind the same transaction()/snapshot() interface as the local Store.

Endpoint code keeps using ``data["records"][table]``, ``data["accounts"]`` and friends. Each table
is a lazy mapping keyed by ``code``: point lookups run ``SELECT ... WHERE code = %s`` and iteration
loads the whole table. Records are plain dicts holding JSON-style values (decimal and date values
as strings), exactly as the local store kept them. On commit every loaded row is compared with
what was read and the differences are written with parameterized INSERT/UPDATE/DELETE statements
in foreign-key order, inside one SQL transaction guarded by an advisory lock (one writer at
a time, like the local file lock). Fields without a column are kept in ``record_extras``.
"""

import contextvars
import copy
import functools
import heapq
import json
import logging
import os
import queue
import threading
import time
import weakref
from collections.abc import MutableMapping, MutableSequence
from contextlib import contextmanager
from datetime import date, datetime, timezone
from datetime import time as daytime
from decimal import Decimal
from uuid import uuid4

import psycopg
from fastapi import HTTPException

from .database import DatabaseSettings, connect

EXTRAS = "record_extras"
EXTRAS_COLUMN = "__edunexa_extras"
# Column types use PostgreSQL's udt names (information_schema.columns.udt_name).
TEXT_TYPES = {"varchar", "text", "bpchar"}
INT_TYPES = {"int2", "int4", "int8"}
# Columns maintained by the database; hidden from records unless the backend contract lists them.
SYSTEM_COLUMNS = {"id", "created_at", "updated_at"}
APP_LOCK = "edunexa-store"
# EDUNEXA_DB_LOG_SQL=1 prints every statement and its parameters (logger "edunexa.sql").
log = logging.getLogger("edunexa.sql")
if os.environ.get("EDUNEXA_DB_LOG_SQL") == "1":
    logging.basicConfig()
    log.setLevel(logging.DEBUG)


# ---------------------------------------------------------------------------
# Schema metadata
# ---------------------------------------------------------------------------


class Column:
    __slots__ = ("name", "type", "nullable", "identity", "json", "array")

    def __init__(self, name, type_, nullable, identity):
        self.name, self.type, self.nullable, self.identity = name, type_, nullable, identity
        self.json = type_ in {"json", "jsonb"}
        self.array = type_.startswith("_")  # e.g. _text for TEXT[]


class Table:
    def __init__(self, name):
        self.name = name
        self.columns: dict[str, Column] = {}
        self.fks: list[tuple[str, str, str]] = []  # (column, parent table, parent column)
        self.deferred: set[str] = set()  # nullable FK columns inside a reference cycle
        self.visible: set[str] = set()


class Metadata:
    def __init__(self, cur, schema, contract_fields):
        self.schema = schema
        self.tables: dict[str, Table] = {}
        cur.execute(
            "SELECT c.table_name, c.column_name, c.udt_name, c.is_nullable = 'YES',"
            " c.is_identity = 'YES' OR COALESCE(c.column_default, '') LIKE 'nextval(%%'"
            " FROM information_schema.columns c JOIN information_schema.tables t"
            "   ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'"
            " WHERE c.table_schema = %s ORDER BY c.table_name, c.ordinal_position",
            (schema,),
        )
        for t, c, ty, nullable, identity in cur.fetchall():
            self.tables.setdefault(t, Table(t)).columns[c] = Column(c, ty, bool(nullable), bool(identity))
        cur.execute(
            "SELECT cl.relname, a.attname, pcl.relname, pa.attname"
            " FROM pg_constraint fk"
            " JOIN pg_class cl ON cl.oid = fk.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace"
            " JOIN pg_class pcl ON pcl.oid = fk.confrelid"
            " JOIN pg_attribute a ON a.attrelid = fk.conrelid AND a.attnum = fk.conkey[1]"
            " JOIN pg_attribute pa ON pa.attrelid = fk.confrelid AND pa.attnum = fk.confkey[1]"
            " WHERE fk.contype = 'f' AND n.nspname = %s",
            (schema,),
        )
        for t, c, pt, pc in cur.fetchall():
            self.tables[t].fks.append((c, pt, pc))
        for t in self.tables.values():
            listed = contract_fields.get(t.name, set())
            hidden = {"id"} if t.name in Session.backing else SYSTEM_COLUMNS - listed
            t.visible = {c for c in t.columns if c not in hidden}
        self.order = self._order()

    def _order(self):
        """Parent-first table order; nullable FKs inside a cycle are written in a second pass."""
        graph = {t: {p for _, p, _ in m.fks if p in self.tables} for t, m in self.tables.items()}
        index, low, stack, on, sccs, counter = {}, {}, [], set(), [], [0]

        def strong(v):  # Tarjan's algorithm, iterative enough for ~150 tables
            index[v] = low[v] = counter[0]
            counter[0] += 1
            stack.append(v)
            on.add(v)
            for w in sorted(graph[v]):
                if w not in index:
                    strong(w)
                    low[v] = min(low[v], low[w])
                elif w in on:
                    low[v] = min(low[v], index[w])
            if low[v] == index[v]:
                scc = set()
                while True:
                    w = stack.pop()
                    on.discard(w)
                    scc.add(w)
                    if w == v:
                        break
                sccs.append(scc)

        for v in sorted(graph):
            if v not in index:
                strong(v)
        # Tarjan emits components after their dependencies (parents) when edges point to parents.
        order = []
        for scc in sccs:
            for t in sorted(scc):
                for c, p, _ in self.tables[t].fks:
                    if p in scc and self.tables[t].columns[c].nullable:
                        self.tables[t].deferred.add(c)
            order.extend(sorted(scc))
        return order


_METADATA: dict[str, Metadata] = {}
_METADATA_LOCK = threading.Lock()


def _contract_fields():
    from .resources import CATALOG  # late import: resources imports storage helpers

    return {t: {f["name"] for f in spec["fields"]} for t, spec in CATALOG.items()}


def metadata(cur, schema):
    with _METADATA_LOCK:
        if schema not in _METADATA:
            _METADATA[schema] = Metadata(cur, schema, _contract_fields())
        return _METADATA[schema]


# ---------------------------------------------------------------------------
# Value conversion between JSON-style records and SQL parameters
# ---------------------------------------------------------------------------


def to_db(col: Column, value):
    if value is None:
        return None
    if col.json:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
    if col.array:
        return [str(v) for v in value] if isinstance(value, (list, tuple)) else value
    ty = col.type
    if ty == "bool":
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "yes"}
        return bool(value)
    if ty in INT_TYPES:
        return int(value)
    if ty == "numeric":
        return Decimal(str(value))
    if ty in {"timestamptz", "timestamp"}:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return datetime.fromtimestamp(value, timezone.utc).isoformat()
        if isinstance(value, datetime):
            return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).isoformat()
        return str(value)
    if ty == "date":
        return value.isoformat()[:10] if isinstance(value, (date, datetime)) else str(value)
    if ty == "time":
        return value.isoformat() if isinstance(value, daytime) else str(value)
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, default=str)
    return str(value)


def loads(value):
    """jsonb arrives decoded; text holding JSON does not."""
    return json.loads(value) if isinstance(value, (str, bytes)) else value


def from_db(col: Column, value):
    if value is None:
        return None
    if col.json:
        return loads(value)
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, (date, daytime)):
        return value.isoformat()
    if col.type == "bool":
        return bool(value)
    return value


def _same(col, a, b):
    """Compare two record values as the database would store them."""
    try:
        return to_db(col, a) == to_db(col, b)
    except (ValueError, ArithmeticError):
        return a == b


# ---------------------------------------------------------------------------
# Connection pool
# ---------------------------------------------------------------------------


class Pool:
    def __init__(self, settings, size=8):
        self.settings, self.idle = settings, queue.LifoQueue(size)

    def get(self):
        while True:
            try:
                conn, last = self.idle.get_nowait()
            except queue.Empty:
                return connect(self.settings)
            if time.monotonic() - last < 60:
                return conn
            try:
                cur = conn.cursor()
                cur.execute("SELECT 1")
                cur.fetchall()
                return conn
            except Exception:
                _close(conn)

    def put(self, conn):
        try:
            conn.rollback()  # no round trip when no transaction is open (autocommit snapshots)
            self.idle.put_nowait((conn, time.monotonic()))
        except Exception:
            _close(conn)


def _close(conn):
    try:
        conn.close()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Table views
# ---------------------------------------------------------------------------

_ABSENT = object()


class Row(dict):
    """A loaded record. Notes each change so writes are replayed in the order the code made them.

    Copies are plain dicts, so detached copies and pickles carry no reference to the session.
    """

    __slots__ = ("_note",)

    def __init__(self, data, note):
        super().__init__(data)
        self._note = note

    def __setitem__(self, key, value):
        super().__setitem__(key, value)
        self._note()

    def __delitem__(self, key):
        super().__delitem__(key)
        self._note()

    def update(self, *args, **kwargs):
        super().update(*args, **kwargs)
        self._note()

    def pop(self, *args):
        value = super().pop(*args)
        self._note()
        return value

    def popitem(self):
        item = super().popitem()
        self._note()
        return item

    def setdefault(self, key, default=None):
        if key not in self:
            self[key] = default
        return super().__getitem__(key)

    def clear(self):
        super().clear()
        self._note()

    def __copy__(self):
        return dict(self)

    def __deepcopy__(self, memo):
        return copy.deepcopy(dict(self), memo)

    def __reduce__(self):
        return (dict, (dict(self),))


class TableView(MutableMapping):
    """One table as {code: record}; loads rows on demand and remembers what it read."""

    def __init__(self, session, table: Table):
        self.s, self.t = session, table
        self.rows: dict = {}
        self.orig: dict = {}  # code -> deep copy of the record as read, or _ABSENT
        self.full = False
        self.seq: dict = {}  # code -> when the code last changed the row (write order)

    # -- loading -----------------------------------------------------------
    def _select(self, where="", params=()):
        cols = ", ".join(f"t.{c}" for c in self.t.visible)
        sql = (
            f"SELECT {cols}, x.data AS {EXTRAS_COLUMN} FROM {self.t.name} t"
            f" LEFT JOIN {EXTRAS} x ON x.table_name = %s AND x.record_code = t.code"
            f" {where}"
        )
        cur = self.s.cursor()
        cur.execute(sql, (self.t.name, *params))
        names = [d[0] for d in cur.description]
        for values in cur.fetchall():
            record = {}
            for name, value in zip(names, values):
                if name == EXTRAS_COLUMN:
                    if value:
                        record.update(loads(value))
                elif value is not None:
                    record[name] = from_db(self.t.columns[name], value)
            code = record["code"]
            if code not in self.orig:
                self.orig[code] = copy.deepcopy(record)
                self.rows[code] = Row(record, functools.partial(self._touch, code))

    def _point(self, code):
        if self.full or code in self.orig or code in self.rows or not isinstance(code, str):
            return
        self._select("WHERE t.code = %s", (code,))
        self.orig.setdefault(code, _ABSENT)

    def load(self):
        if not self.full:
            self._select()
            self.full = True
        return self

    # -- mapping protocol --------------------------------------------------
    def __getitem__(self, code):
        self._point(code)
        return self.rows[code]

    def _touch(self, code):
        self.seq[code] = self.s.next_seq()

    def __setitem__(self, code, record):
        self._point(code)
        self.rows[code] = record
        self._touch(code)

    def __delitem__(self, code):
        self._point(code)
        del self.rows[code]

    def __contains__(self, code):
        self._point(code)
        return code in self.rows

    def __iter__(self):
        self.load()
        return iter(list(self.rows))

    def __len__(self):
        self.load()
        return len(self.rows)

    def __repr__(self):
        return f"<TableView {self.t.name}: {len(self.rows)} loaded>"

    def clone(self, session):
        other = TableView(session, self.t)
        other.rows, other.orig, other.full = copy.deepcopy(self.rows), copy.deepcopy(self.orig), self.full
        return other

    # -- explicit SQL (module api.py queries) ------------------------------
    def adopt(self, record):
        """Register a row read by explicit SQL; an already cached row is the current version."""
        code = record["code"]
        if code in self.rows and self.orig.get(code, _ABSENT) is not _ABSENT:
            return self.rows[code]
        self.orig[code] = copy.deepcopy(record)
        self.rows[code] = Row(record, functools.partial(self._touch, code))
        return self.rows[code]

    def persisted(self, record):
        """A row explicit SQL just wrote; later changes to the same dict are still detected."""
        self.orig[record["code"]] = copy.deepcopy(record)
        self.rows[record["code"]] = record

    def removed(self, code):
        self.rows.pop(code, None)
        self.orig[code] = _ABSENT

    def rebase(self):
        """After an intermediate flush, what is in memory is what the database holds."""
        absent = {c: _ABSENT for c, v in self.orig.items() if v is _ABSENT and c not in self.rows}
        self.orig = {**absent, **{c: copy.deepcopy(r) for c, r in self.rows.items()}}
        self.seq = {}

    # -- change detection --------------------------------------------------
    def split(self, record):
        cols = {k: v for k, v in record.items() if k in self.t.columns and not self.t.columns[k].identity}
        extras = {k: v for k, v in record.items() if k not in self.t.columns}
        return cols, extras

    def changes(self):
        inserts, updates, deletes = [], [], []
        for code, record in self.rows.items():
            if record.get("code", code) != code:
                record = {**record, "code": code}
            before = self.orig.get(code, _ABSENT)
            if before is _ABSENT:
                inserts.append((code, record, self.seq.get(code) or self.s.next_seq()))
                continue
            cols, extras = self.split(record)
            old_cols, old_extras = self.split(before)
            changed = {
                k: cols.get(k)
                for k in set(cols) | set(old_cols)
                if k in self.t.visible and not _same(self.t.columns[k], cols.get(k), old_cols.get(k))
                # a database-maintained timestamp left out of the new record keeps its stored value
                and not (k in SYSTEM_COLUMNS and k not in cols)
            }
            if changed or extras != old_extras:
                updates.append((code, changed, extras, extras != old_extras, self.seq.get(code) or self.s.next_seq()))
        for code, before in self.orig.items():
            if before is not _ABSENT and code not in self.rows:
                deletes.append(code)
        return inserts, updates, deletes


class RecordsView(MutableMapping):
    """data["records"]: table name -> TableView (unknown names hold plain in-memory dicts)."""

    def __init__(self, session):
        self.s = session

    def __getitem__(self, table):
        return self.s.table(table)

    def __setitem__(self, table, rows):
        view = self.s.table(table)
        view.load()
        view.rows = {}
        for code, record in dict(rows).items():
            view[code] = record

    def __delitem__(self, table):
        self[table] = {}

    def __iter__(self):
        return iter(sorted(t for t in self.s.meta.tables if t not in self.s.backing))

    def __len__(self):
        return sum(1 for _ in self)

    def __contains__(self, table):
        return table in self.s.meta.tables


# ---------------------------------------------------------------------------
# Mapped collections (accounts, roles, sessions, forms, submissions, audit, attempts)
# ---------------------------------------------------------------------------


def _epoch(value):
    return datetime.fromisoformat(value).timestamp() if isinstance(value, str) else value


class Mapped(MutableMapping):
    """A backend collection stored in one table, translated per item; children optional."""

    table = ""

    def __init__(self, session):
        self.s = session
        self.items_: dict = {}
        self.orig: dict = {}
        self.full = False

    # Subclasses translate between the backend object and the table row.
    def decode(self, row):
        return row

    def encode(self, key, obj):
        return obj

    def view(self):
        return self.s.table(self.table)

    def _take(self, key):
        row = self.view().rows.get(key)
        if row is not None and key not in self.items_ and key not in self.orig:
            obj = self.decode(row)
            self.items_[key] = obj
            self.orig[key] = copy.deepcopy(obj)

    def _point(self, key):
        if self.full or key in self.orig or key in self.items_:
            return
        self.view()._point(key)
        self._take(key)
        self.orig.setdefault(key, _ABSENT)

    def load(self):
        if not self.full:
            self.view().load()
            self.preload()
            for key in list(self.view().rows):
                self._take(key)
            self.full = True
        return self

    def preload(self):
        pass

    def __getitem__(self, key):
        self._point(key)
        return self.items_[key]

    def __setitem__(self, key, obj):
        self._point(key)
        self.items_[key] = obj

    def __delitem__(self, key):
        self._point(key)
        del self.items_[key]

    def __contains__(self, key):
        self._point(key)
        return key in self.items_

    def __iter__(self):
        self.load()
        return iter(list(self.items_))

    def __len__(self):
        self.load()
        return len(self.items_)

    def clone(self, session):
        other = type(self)(session)
        other.items_, other.orig, other.full = copy.deepcopy(self.items_), copy.deepcopy(self.orig), self.full
        return other

    def rebase(self):
        absent = {k: _ABSENT for k, v in self.orig.items() if v is _ABSENT and k not in self.items_}
        self.orig = {**absent, **copy.deepcopy(self.items_)}

    def push(self):
        """Write changed objects into the backing table views before the flush."""
        view = self.view()
        for key, obj in self.items_.items():
            before = self.orig.get(key, _ABSENT)
            if before is not _ABSENT and _json(before) == _json(obj):
                continue
            view[key] = self.encode(key, obj)
            self.push_children(key, obj, before)
        for key, before in self.orig.items():
            if before is not _ABSENT and key not in self.items_:
                self.delete_children(key)
                del view[key]

    def push_children(self, key, obj, before):
        pass

    def delete_children(self, key):
        pass


def _json(value):
    return json.dumps(value, sort_keys=True, default=str)


def _extras(obj, known):
    return {k: v for k, v in obj.items() if k not in known}


class Accounts(Mapped):
    table = "users"
    PERSON = {"employee": "employee_code", "student": "student_code", "parent": "parent_code"}
    KNOWN = {"code", "login_id", "password_hash", "active", "person_type", "person_code", "role_codes", "clients", "email"}

    def roles_of(self, key):
        links = self.s.table("user_roles")
        if not links.full:
            links._select("WHERE t.user_code = %s", (key,))
        return sorted(r["role_code"] for r in links.rows.values() if r["user_code"] == key)

    def preload(self):
        self.s.table("user_roles").load()

    def decode(self, row):
        account = {k: v for k, v in row.items() if k not in self.s.table("users").t.columns}
        account.update(code=row["code"], login_id=row["login_id"], password_hash=row["password_hash"],
                       active=bool(row["is_active"]), clients=row.get("allowed_clients", []),
                       role_codes=self.roles_of(row["code"]))
        if row.get("email") is not None:
            account["email"] = row["email"]
        for person_type, column in self.PERSON.items():
            if row.get(column):
                account["person_type"], account["person_code"] = person_type, row[column]
        return account

    def encode(self, key, obj):
        row = {"code": key, "login_id": obj["login_id"], "password_hash": obj["password_hash"],
               "is_active": bool(obj.get("active", True)), "allowed_clients": obj.get("clients", []),
               "email": obj.get("email")}
        column = self.PERSON.get(obj.get("person_type"))
        extras = _extras(obj, self.KNOWN)
        if column:
            row[column] = obj.get("person_code")
        else:  # bootstrap/system accounts are not linked to a person record
            extras.update(person_type=obj.get("person_type"), person_code=obj.get("person_code"))
        return {**row, **extras}

    def push_children(self, key, obj, before):
        links = self.s.table("user_roles")
        if not links.full:
            links._select("WHERE t.user_code = %s", (key,))
        wanted = set(obj.get("role_codes", []))
        for code, link in list(links.rows.items()):
            if link["user_code"] == key and link["role_code"] not in wanted:
                del links[code]
        have = {r["role_code"] for r in links.rows.values() if r["user_code"] == key}
        for role in sorted(wanted - have):
            code = "UR-" + uuid4().hex
            links[code] = {"code": code, "user_code": key, "role_code": role}

    def delete_children(self, key):
        self.push_children(key, {"role_codes": []}, None)


class Roles(Mapped):
    table = "roles"
    KNOWN = {"code", "name", "scope", "system_admin", "protected", "permissions"}

    def preload(self):
        # One compact row per role instead of every role_permissions row: listing roles over a
        # distant link is dominated by the bytes transferred.
        if getattr(self.s.meta, "dialect", "postgres") == "sqlserver":
            self.compact = {}
            for link in self.s.table("role_permissions").load().values():
                self.compact.setdefault(link["role_code"], []).append(link["permission_code"])
            return
        cur = self.s.cursor()
        cur.execute("SELECT role_code, array_agg(permission_code ORDER BY permission_code)"
                    " FROM role_permissions GROUP BY role_code")
        self.compact = dict(cur.fetchall())

    def grants(self, key):
        links = self.s.table("role_permissions")
        compact = getattr(self, "compact", None)
        if compact is not None and not links.seq:  # no unsaved permission changes in this session
            permissions = {}
            for code in compact.get(key, []):
                screen, _, action = code.partition(":")
                permissions.setdefault(screen, []).append(action)
            return {screen: sorted(actions) for screen, actions in permissions.items()}
        if not links.full:
            links._select("WHERE t.role_code = %s", (key,))
        permissions = {}
        for link in links.rows.values():
            if link["role_code"] == key:
                screen, _, action = link["permission_code"].partition(":")
                permissions.setdefault(screen, []).append(action)
        return {screen: sorted(actions) for screen, actions in permissions.items()}

    def decode(self, row):
        role = {k: v for k, v in row.items() if k not in self.s.table("roles").t.columns}
        role.update(code=row["code"], name=row["name"], scope=row.get("scope", "college"),
                    system_admin=bool(row.get("is_system_admin")), permissions=self.grants(row["code"]))
        if row.get("is_protected"):
            role["protected"] = True
        return role

    def encode(self, key, obj):
        return {"code": key, "name": obj.get("name") or key, "scope": obj.get("scope", "college"),
                "is_system_admin": bool(obj.get("system_admin")), "is_protected": bool(obj.get("protected")),
                **_extras(obj, self.KNOWN)}

    def push_children(self, key, obj, before):
        links, catalog = self.s.table("role_permissions"), self.s.table("permissions")
        if not links.full:
            links._select("WHERE t.role_code = %s", (key,))
        wanted = {f"{screen}:{action}" for screen, actions in (obj.get("permissions") or {}).items() for action in actions}
        for code, link in list(links.rows.items()):
            if link["role_code"] == key and link["permission_code"] not in wanted:
                del links[code]
        have = {r["permission_code"] for r in links.rows.values() if r["role_code"] == key}
        for permission in sorted(wanted - have):
            if permission not in catalog:
                catalog[permission] = {"code": permission, "name": permission}
            code = "RP-" + uuid4().hex
            links[code] = {"code": code, "role_code": key, "permission_code": permission}

    def delete_children(self, key):
        self.push_children(key, {"permissions": {}}, None)


class Sessions(Mapped):
    table = "refresh_tokens"
    KNOWN = {"code", "user_code", "refresh_hash", "expires_at", "revoked", "used", "family", "client"}

    def __init__(self, session):
        super().__init__(session)
        self.stamps = {}  # code -> (revoked_at, used_at) as stored, so flags keep their original time

    def decode(self, row):
        session = {k: v for k, v in row.items() if k not in self.s.table(self.table).t.columns}
        session.update(code=row["code"], user_code=row["user_code"], refresh_hash=row["token_hash"],
                       expires_at=_epoch(row["expires_at"]), revoked=row.get("revoked_at") is not None,
                       used=row.get("used_at") is not None, family=row["family_code"], client=row["client_id"])
        self.stamps[row["code"]] = (row.get("revoked_at"), row.get("used_at"))
        return session

    def encode(self, key, obj):
        stamp = datetime.now(timezone.utc).isoformat()
        revoked_at, used_at = self.stamps.get(key, (None, None))
        return {"code": key, "user_code": obj["user_code"], "token_hash": obj["refresh_hash"],
                "expires_at": obj["expires_at"], "family_code": obj["family"], "client_id": obj["client"],
                "revoked_at": (revoked_at or stamp) if obj.get("revoked") else None,
                "used_at": (used_at or stamp) if obj.get("used") else None,
                **_extras(obj, self.KNOWN)}

    def clone(self, session):
        other = super().clone(session)
        other.stamps = dict(self.stamps)
        return other


class Forms(Mapped):
    table = "form_definitions"
    KNOWN = {"code", "name", "screen", "fields", "published", "revision", "updated_at"}

    def decode(self, row):
        form = {k: v for k, v in row.items() if k not in self.s.table(self.table).t.columns}
        form.update(code=row["code"], name=row["name"], screen=row["screen"], fields=row["fields"],
                    published=bool(row["is_published"]), revision=row["revision"])
        if row.get("updated_at"):
            form["updated_at"] = row["updated_at"]
        return form

    def encode(self, key, obj):
        return {"code": key, "name": obj["name"], "screen": obj["screen"], "fields": obj["fields"],
                "is_published": bool(obj.get("published")), "revision": obj.get("revision", 1),
                "updated_at": obj.get("updated_at"), **_extras(obj, self.KNOWN)}


class Submissions(Mapped):
    table = "form_submissions"
    KNOWN = {"code", "form_code", "revision", "definition", "values", "submitted_by", "submitted_at", "entity_code"}

    def decode(self, row):
        sub = {k: v for k, v in row.items() if k not in self.s.table(self.table).t.columns}
        sub.update(code=row["code"], form_code=row["form_code"], revision=row["revision"],
                   definition=row["definition"], values=row["submitted_values"],
                   submitted_by=row.get("submitted_by_user_code"), submitted_at=row["submitted_at"])
        if row.get("entity_code") is not None:
            sub["entity_code"] = row["entity_code"]
        return sub

    def encode(self, key, obj):
        return {"code": key, "form_code": obj["form_code"], "revision": obj["revision"],
                "definition": obj["definition"], "submitted_values": obj["values"],
                "submitted_by_user_code": obj.get("submitted_by"), "submitted_at": obj.get("submitted_at"),
                "entity_code": obj.get("entity_code"), **_extras(obj, self.KNOWN)}


class AuditLog(MutableSequence):
    """Append-only audit list; existing entries are read only when the list is inspected."""

    KNOWN = {"code", "actor", "action", "resource", "entity_code", "occurred_at"}

    def __init__(self, session):
        self.s, self.loaded, self.new = session, None, []

    def _all(self):
        if self.loaded is None:
            view = self.s.table("audit_logs").load()
            rows = sorted(view.rows.values(), key=lambda r: (r["occurred_at"], r["code"]))
            self.loaded = [self.decode(r) for r in rows]
        return self.loaded + self.new

    def decode(self, row):
        entry = {k: v for k, v in row.items() if k not in self.s.table("audit_logs").t.columns}
        entry.update(code=row["code"], actor=row.get("actor_code"), action=row["action"],
                     resource=row["entity_table"], entity_code=row["entity_code"], occurred_at=row["occurred_at"])
        return entry

    def __getitem__(self, i):
        return self._all()[i]

    def __len__(self):
        return len(self._all())

    def __setitem__(self, i, v):
        raise TypeError("Audit history is append-only")

    def __delitem__(self, i):
        raise TypeError("Audit history is append-only")

    def insert(self, i, v):
        if i < len(self):
            raise TypeError("Audit history is append-only")
        self.new.append(v)

    def append(self, v):
        self.new.append(v)

    def clone(self, session):
        other = AuditLog(session)
        other.loaded, other.new = copy.deepcopy(self.loaded), copy.deepcopy(self.new)
        return other

    def push(self):
        view = self.s.table("audit_logs")
        for e in self.new:
            view.rows[e["code"]] = {"code": e["code"], "actor_code": e.get("actor"), "action": e["action"],
                                    "entity_table": e["resource"], "entity_code": str(e.get("entity_code") or "-"),
                                    "occurred_at": e["occurred_at"], **_extras(e, self.KNOWN)}
            view.orig.setdefault(e["code"], _ABSENT)
        if self.loaded is not None:
            self.loaded.extend(self.new)
        self.new = []

    def rebase(self):
        pass


class LoginAttempts(MutableMapping):
    """{throttle key: [epoch seconds]} stored one row per attempt."""

    def __init__(self, session):
        self.s, self.items_, self.orig = session, {}, {}

    def _point(self, key):
        if key in self.orig:
            return
        cur = self.s.cursor()
        cur.execute("SELECT attempted_at FROM login_attempts WHERE attempt_key = %s"
                    " ORDER BY attempted_at", (key,))
        times = [v[0].timestamp() for v in cur.fetchall()]
        self.orig[key] = list(times)
        if times:
            self.items_[key] = times

    def __getitem__(self, key):
        self._point(key)
        return self.items_[key]

    def __setitem__(self, key, times):
        self._point(key)
        self.items_[key] = times

    def __delitem__(self, key):
        self._point(key)
        del self.items_[key]

    def __contains__(self, key):
        self._point(key)
        return key in self.items_

    def __iter__(self):
        return iter(list(self.items_))

    def __len__(self):
        return len(self.items_)

    def rebase(self):
        self.orig = {k: list(self.items_.get(k, [])) for k in self.orig}

    def clone(self, session):
        other = LoginAttempts(session)
        other.items_, other.orig = copy.deepcopy(self.items_), copy.deepcopy(self.orig)
        return other

    def write(self, cur, schema):
        for key, before in self.orig.items():
            now = self.items_.get(key, [])
            if now == before:
                continue
            cur.execute("DELETE FROM login_attempts WHERE attempt_key = %s", (key,))
            for t in now:
                cur.execute(
                    "INSERT INTO login_attempts (code, attempt_key, attempted_at) VALUES (%s, %s, %s)",
                    ("LA-" + uuid4().hex, key, datetime.fromtimestamp(t, timezone.utc).isoformat()),
                )
        if self.orig:  # keep the table small: windows are 15 minutes
            cutoff = "DATEADD(day,-1,SYSUTCDATETIME())" if getattr(self.s.meta, "dialect", "postgres") == "sqlserver" else "now() - interval '1 day'"
            cur.execute(f"DELETE FROM login_attempts WHERE attempted_at < {cutoff}")


class ImportMetadata(MutableMapping):
    """data["import_metadata"]: {table: {code: {...}}}, kept in record_extras as 'import_metadata:<table>'."""

    PREFIX = "import_metadata:"

    def __init__(self, session):
        self.s, self.tables, self.orig = session, {}, {}

    def __getitem__(self, table):
        if table not in self.tables:
            cur = self.s.cursor()
            cur.execute(f"SELECT record_code, data FROM {EXTRAS} WHERE table_name = %s",
                        (self.PREFIX + table,))
            rows = {code: loads(value) for code, value in cur.fetchall()}
            self.tables[table], self.orig[table] = rows, copy.deepcopy(rows)
        return self.tables[table]

    def __setitem__(self, table, rows):
        self[table]  # remember what is stored so the replacement is written as a diff
        self.tables[table] = dict(rows)

    def __delitem__(self, table):
        self[table] = {}

    def __iter__(self):
        return iter(list(self.tables))

    def __len__(self):
        return len(self.tables)

    def rebase(self):
        self.orig = copy.deepcopy(self.tables)

    def clone(self, session):
        other = ImportMetadata(session)
        other.tables, other.orig = copy.deepcopy(self.tables), copy.deepcopy(self.orig)
        return other

    def write(self, cur, schema):
        for table, rows in self.tables.items():
            before = self.orig.get(table, {})
            for code in set(before) | set(rows):
                if before.get(code) == rows.get(code):
                    continue
                cur.execute(f"DELETE FROM {EXTRAS} WHERE table_name = %s AND record_code = %s",
                            (self.PREFIX + table, code))
                if code in rows:
                    cur.execute(f"INSERT INTO {EXTRAS} (table_name, record_code, data) VALUES (%s, %s, %s)",
                                (self.PREFIX + table, code, json.dumps(rows[code], ensure_ascii=False, sort_keys=True, default=str)))


MAPPED = {"accounts": Accounts, "roles": Roles, "sessions": Sessions, "forms": Forms, "submissions": Submissions}


# ---------------------------------------------------------------------------
# Session (one unit of work) and root object
# ---------------------------------------------------------------------------


class Session(MutableMapping):
    """The ``data`` object handed to endpoint code."""

    backing = {"users", "user_roles", "roles", "role_permissions", "permissions", "refresh_tokens",
               "audit_logs", "form_definitions", "form_submissions", "login_attempts", EXTRAS, "schema_migrations"}

    def __init__(self, conn, meta, writable):
        self.conn, self.meta, self.schema, self.writable = conn, meta, meta.schema, writable
        self.tables: dict = {}
        self.parts: dict = {}
        self._cursor = None
        self._seq = 0

    def next_seq(self):
        self._seq += 1
        return self._seq

    def cursor(self):
        if self._cursor is None:
            self._cursor = _LoggedCursor(self.conn.cursor())
        return self._cursor

    def table(self, name):
        if name not in self.tables:
            if name not in self.meta.tables:
                self.tables[name] = {}  # unknown resource: in-memory only, must stay empty
            else:
                self.tables[name] = TableView(self, self.meta.tables[name])
        return self.tables[name]

    def part(self, key):
        if key not in self.parts:
            if key == "records":
                self.parts[key] = RecordsView(self)
            elif key == "audit":
                self.parts[key] = AuditLog(self)
            elif key == "login_attempts":
                self.parts[key] = LoginAttempts(self)
            elif key == "import_metadata":
                self.parts[key] = ImportMetadata(self)
            elif key in MAPPED:
                self.parts[key] = MAPPED[key](self)
            else:
                raise KeyError(key)
        return self.parts[key]

    # -- mapping protocol for the root -------------------------------------
    KEYS = ("records", "accounts", "roles", "sessions", "audit", "forms", "submissions", "login_attempts",
            "import_metadata")

    def __getitem__(self, key):
        return self.part(key)

    def __setitem__(self, key, value):
        part = self.part(key)
        if key == "records":
            tables = dict(value)
            for name in self.meta.tables:
                if name not in self.backing:
                    part[name] = tables.get(name, {})
            for name in set(tables) - set(self.meta.tables):
                part[name] = tables[name]
        elif key == "audit":
            for entry in value:
                part.append(entry)
        else:
            for k in list(part):
                del part[k]
            for k, v in dict(value).items():
                part[k] = v

    def __delitem__(self, key):
        raise TypeError("Store sections cannot be removed")

    def __iter__(self):
        return iter(self.KEYS)

    def __len__(self):
        return len(self.KEYS)

    def __deepcopy__(self, memo):
        """Detached, read-only copy: loaded data is copied, the rest is read lazily."""
        other = Session(self.conn, self.meta, writable=False)
        other.parent = self  # keeps the shared connection checked out while the copy is alive
        for name, view in self.tables.items():
            other.tables[name] = view.clone(other) if isinstance(view, TableView) else copy.deepcopy(view, memo)
        for key, part in self.parts.items():
            other.parts[key] = RecordsView(other) if key == "records" else part.clone(other)
        return other

    # -- flush -------------------------------------------------------------
    def sync(self):
        """Write pending changes now so explicit SQL in module api.py sees them (same transaction)."""
        if not self.writable:
            return
        self.flush()
        for view in self.tables.values():
            if isinstance(view, TableView):
                view.rebase()
        for part in self.parts.values():
            if hasattr(part, "rebase"):
                part.rebase()

    def flush(self):
        for key in ("accounts", "roles", "sessions", "forms", "submissions", "audit"):
            if key in self.parts:
                self.parts[key].push()
        for name, view in self.tables.items():
            if not isinstance(view, TableView) and view:
                raise HTTPException(500, f"No database table for resource {name}")
        cur = _Batch(self.cursor())
        plan = {name: view.changes() for name, view in self.tables.items() if isinstance(view, TableView)}
        order = [t for t in self.meta.order if t in plan]
        inserted = {(name, code) for name in plan for code, _, _ in plan[name][0]}

        # 1. deletes, children first (nullable cycle references cleared first)
        for name in reversed(order):
            deletes = plan[name][2]
            if not deletes:
                continue
            t = self.meta.tables[name]
            for code in deletes:
                if t.deferred:
                    sets = ", ".join(f"{c} = NULL" for c in sorted(t.deferred))
                    cur.execute(f"UPDATE {name} SET {sets} WHERE code = %s", (code,))
            for code in deletes:
                cur.execute(f"DELETE FROM {name} WHERE code = %s", (code,))
                cur.execute(f"DELETE FROM {EXTRAS} WHERE table_name = %s AND record_code = %s",
                            (name, code))

        # 2. inserts and updates in the order the code made them; an operation waits for the
        #    new rows it references. Nullable references to new rows inside a reference cycle are
        #    written by a follow-up update once their target exists.
        ops = []  # (seq, kind, table, code, payload)
        for name in order:
            t = self.meta.tables[name]
            view = self.tables[name]
            for code, record, seq in plan[name][0]:
                cols, extras = view.split({**record, "code": code})
                cols = {k: v for k, v in cols.items() if v is not None}
                later = {c: cols.pop(c) for c in list(cols) if c in t.deferred and (self._fk_target(t, c), cols[c]) in inserted}
                ops.append((seq, "insert", name, code, (cols, extras)))
                if later:
                    ops.append((seq, "update", name, code, (later, {}, False)))
            for code, changed, extras, extras_changed, seq in plan[name][1]:
                ops.append((seq, "update", name, code, (changed, extras, extras_changed)))

        insert_at = {(op[2], op[3]): i for i, op in enumerate(ops) if op[1] == "insert"}
        waits = [set() for _ in ops]
        for i, (seq, kind, name, code, payload) in enumerate(ops):
            values = payload[0]
            for c, p, _ in self.meta.tables[name].fks:
                j = insert_at.get((p, values.get(c)))
                if j is not None and j != i and c in values:
                    waits[i].add(j)
            if kind == "update" and (name, code) in insert_at:
                waits[i].add(insert_at[(name, code)])
        blocked = {i: set(w) for i, w in enumerate(waits)}
        followers = [[] for _ in ops]
        for i, w in enumerate(waits):
            for j in w:
                followers[j].append(i)
        ready = [(ops[i][0], i) for i, w in blocked.items() if not w]
        heapq.heapify(ready)
        done = set()
        while len(done) < len(ops):
            if not ready:  # unresolvable cycle: write in code order and let the database decide
                i = min(set(range(len(ops))) - done, key=lambda k: ops[k][0])
            else:
                _, i = heapq.heappop(ready)
                if i in done:
                    continue
            done.add(i)
            _, kind, name, code, payload = ops[i]
            if kind == "insert":
                self._insert(cur, name, code, *payload)
            else:
                self._update(cur, name, code, *payload)
            for f in followers[i]:
                blocked[f].discard(i)
                if not blocked[f] and f not in done:
                    heapq.heappush(ready, (ops[f][0], f))

        for key in ("login_attempts", "import_metadata"):
            if key in self.parts:
                self.parts[key].write(cur, self.schema)
        cur.run()

    def _fk_target(self, t, column):
        return next(p for c, p, _ in t.fks if c == column)

    def _insert(self, cur, name, code, cols, extras):
        t = self.meta.tables[name]
        names = ", ".join(k for k in cols)
        marks = ", ".join(["%s"] * len(cols))
        cur.execute(f"INSERT INTO {name} ({names}) VALUES ({marks})",
                    tuple(to_db(t.columns[k], v) for k, v in cols.items()))
        if extras:
            self._extras(cur, name, code, extras, insert=True)

    def _update(self, cur, name, code, changed, extras, extras_changed):
        t = self.meta.tables[name]
        if changed:
            sets = ", ".join(f"{k} = %s" for k in changed)
            cur.execute(f"UPDATE {name} SET {sets} WHERE code = %s",
                        (*(to_db(t.columns[k], v) for k, v in changed.items()), code))
        if extras_changed:
            self._extras(cur, name, code, extras)

    def _extras(self, cur, name, code, extras, insert=False):
        if not insert:
            cur.execute(f"DELETE FROM {EXTRAS} WHERE table_name = %s AND record_code = %s",
                        (name, code))
        if extras:
            cur.execute(f"INSERT INTO {EXTRAS} (table_name, record_code, data) VALUES (%s, %s, %s)",
                        (name, code, json.dumps(extras, ensure_ascii=False, sort_keys=True, default=str)))


class _LoggedCursor:
    """Cursor wrapper that logs statements when EDUNEXA_DB_LOG_SQL=1."""

    def __init__(self, cur):
        self.cur = cur

    def execute(self, sql, params=None):
        if log.isEnabledFor(logging.DEBUG):
            log.debug("%s\n  params=%r", sql, params)
        return self.cur.execute(sql, params)

    def __getattr__(self, name):
        return getattr(self.cur, name)


class _Batch:
    """Collects parameterized statements and sends them in a few round trips, in order.

    Connections use client-side binding (psycopg.ClientCursor), so joined statements stay
    parameterized.
    """

    SIZE = 200

    def __init__(self, cur):
        self.cur, self.sql, self.params = cur, [], []

    def execute(self, sql, params=()):
        self.sql.append(sql)
        self.params.extend(params)
        if len(self.sql) >= self.SIZE:
            self.run()

    def run(self):
        if self.sql:
            sql, params = ";\n".join(self.sql), tuple(self.params)
            self.sql, self.params = [], []
            self.cur.execute(sql, params or None)


# ---------------------------------------------------------------------------
# Store
# ---------------------------------------------------------------------------


def _http_error(exc):
    """Turn a database rule violation into a client error with the rule's message."""
    state = getattr(exc, "sqlstate", None)
    diag = getattr(exc, "diag", None)
    message = (diag.message_primary if diag else None) or str(exc)
    if state == "P0001":  # RAISE EXCEPTION in a validation trigger
        return HTTPException(409, message)
    if state == "23505":
        return HTTPException(409, "A record with the same unique value already exists")
    if state in ("23503", "23514"):
        return HTTPException(409, "Change conflicts with a database rule: " + message)
    if state == "55P03":
        return HTTPException(503, "The database is busy; try again")
    return None


# Snapshots opened while handling one request; released when the request ends (see request_scope).
_REQUEST_SNAPSHOTS: contextvars.ContextVar = contextvars.ContextVar("edunexa_request_snapshots", default=None)


class PostgresStore:
    def __init__(self, settings: DatabaseSettings | None = None):
        self.settings = settings or DatabaseSettings()
        self.schema = self.settings.db_schema
        self.pool = Pool(self.settings)
        self.open_snapshots: list = []  # weak references; sessions are mappings, so not hashable

    def _meta(self, conn):
        return metadata(conn.cursor(), self.schema)

    @contextmanager
    def transaction(self, prepare=None):
        """One unit of work. ``prepare(session)``, if given, runs just before the changes are written."""
        conn = self.pool.get()
        conn.autocommit = False
        ok = False
        try:
            cur = conn.cursor()
            try:
                # The lock is database-wide; key it by schema so test schemas never block the live one.
                cur.execute("SET LOCAL lock_timeout = '30s'; SELECT pg_advisory_xact_lock(hashtext(%s))",
                            (f"{APP_LOCK}:{self.schema}",))
            except psycopg.errors.LockNotAvailable:
                raise HTTPException(503, "The database is busy; try again") from None
            session = Session(conn, self._meta(conn), writable=True)
            yield session
            try:
                if prepare:
                    prepare(session)
                session.flush()
                conn.commit()
            except psycopg.Error as exc:
                error = _http_error(exc)
                if error is None:
                    raise
                raise error from None
            ok = True
        finally:
            if ok:
                self.pool.put(conn)
            else:
                try:
                    conn.rollback()
                except Exception:
                    _close(conn)
                else:
                    self.pool.put(conn)

    def snapshot(self):
        """Read-only view; tables load lazily on its own connection.

        Each statement reads committed data (autocommit, so no BEGIN round trip). The connection
        goes back to the pool when the request that opened the view ends, or, outside a request,
        when the view is garbage collected.
        """
        conn = self.pool.get()
        conn.autocommit = True
        session = Session(conn, self._meta(conn), writable=False)
        release = weakref.finalize(session, self.pool.put, conn)
        opened = _REQUEST_SNAPSHOTS.get()
        if opened is not None:
            opened.append(release)
        self.open_snapshots = [r for r in self.open_snapshots if r() is not None] + [weakref.ref(session)]
        return session

    @contextmanager
    def request_scope(self):
        """Return the connections of snapshots opened inside the block to the pool when it ends."""
        opened = []
        token = _REQUEST_SNAPSHOTS.set(opened)
        try:
            yield
        finally:
            _REQUEST_SNAPSHOTS.reset(token)
            for release in opened:
                release()  # finalize runs at most once

    def close(self):
        """Close every connection this store opened (application shutdown, test teardown)."""
        for ref in self.open_snapshots:
            session = ref()
            if session is not None:
                _close(session.conn)
        self.open_snapshots = []
        while True:
            try:
                conn, _ = self.pool.idle.get_nowait()
            except queue.Empty:
                break
            _close(conn)
