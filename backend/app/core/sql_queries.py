"""Runs the explicit PostgreSQL statements written in each screen module's api.py.

The statements stay in the module (LIST_SQL, GET_SQL, INSERT_SQL, UPDATE_SQL, DELETE_SQL,
REFERENCED_BY_SQL). This helper binds the record's values as parameters, converts SQL values to
the JSON-style values the services use, keeps custom fields (record_extras) with the record, and
registers rows with the request's transaction so workflow code and explicit SQL never disagree.
With the local JSON store (offline development) the same calls fall back to the JSON records.
"""

import json

import psycopg

from .sql_store import EXTRAS, Session, _http_error, from_db, loads, to_db

EXTRAS_ALIAS = "extras"


def is_sql(data):
    return isinstance(data, Session)


def _execute(data, sql, params):
    cur = data.cursor()
    try:
        cur.execute(sql, params)
    except psycopg.Error as exc:
        error = _http_error(exc)
        if error is None:
            raise
        raise error from None
    return cur


def _read(data, table, sql, params):
    data.sync()
    view = data.table(table)
    cur = _execute(data, sql, params)
    names = [d[0] for d in cur.description]
    rows = []
    for values in cur.fetchall():
        record = {}
        for name, value in zip(names, values):
            if name == EXTRAS_ALIAS:
                if value:
                    record.update(loads(value))
            elif value is not None:
                record[name] = from_db(view.t.columns[name], value)
        rows.append(view.adopt(record))
    return rows


def fetch_all(data, table, sql, params=None):
    """Every row of the table (LIST_SQL)."""
    if not is_sql(data):
        return list(data["records"].get(table, {}).values())
    rows = _read(data, table, sql, params or {})
    data.table(table).full = True
    return rows


def fetch_one(data, table, sql, code):
    """One row by code (GET_SQL), or None."""
    if not is_sql(data):
        return data["records"].get(table, {}).get(code)
    rows = _read(data, table, sql, {"code": code})
    return rows[0] if rows else None


def _params(view, record):
    return {name: to_db(col, record.get(name)) for name, col in view.t.columns.items()
            if name in view.t.visible and not col.identity}


def _write_extras(data, table, code, extras):
    _execute(data, f"DELETE FROM {EXTRAS} WHERE table_name = %(table)s AND record_code = %(code)s",
             {"table": table, "code": code})
    if extras:
        _execute(data, f"INSERT INTO {EXTRAS} (table_name, record_code, data)"
                       " VALUES (%(table)s, %(code)s, %(data)s)",
                 {"table": table, "code": code,
                  "data": json.dumps(extras, ensure_ascii=False, sort_keys=True, default=str)})


def save(data, table, record, insert_sql, update_sql):
    """INSERT_SQL for a new code, UPDATE_SQL for an existing one; returns the record."""
    if not is_sql(data):
        data["records"].setdefault(table, {})[record["code"]] = record
        return record
    data.sync()
    view = data.table(table)
    code = record["code"]
    exists = code in view
    _, extras = view.split(record)
    _execute(data, update_sql if exists else insert_sql, _params(view, record))
    if extras or exists:
        _write_extras(data, table, code, extras)
    view.persisted(record)
    return record


def delete(data, table, sql, code):
    """DELETE_SQL for one code, with its custom fields."""
    if not is_sql(data):
        del data["records"][table][code]
        return
    data.sync()
    _execute(data, sql, {"code": code})
    _write_extras(data, table, code, {})
    data.table(table).removed(code)


def referenced_by(data, table, sql, code):
    """Name of a table still referencing the record (REFERENCED_BY_SQL), or None."""
    if not is_sql(data):
        from .resources import CATALOG

        for other, schema in CATALOG.items():
            for field in schema["fields"]:
                if field["reference"] == table and any(
                    row.get(field["name"]) == code for row in data["records"].get(other, {}).values()
                ):
                    return other
        return None
    if sql is None:
        return None
    data.sync()
    row = _execute(data, sql, {"code": code}).fetchone()
    return row[0] if row else None
