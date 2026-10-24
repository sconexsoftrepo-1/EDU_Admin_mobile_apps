"""SQL Server persistence using the same lazy record sessions as PostgreSQL.

Module CRUD uses the dialect-neutral record path; PostgreSQL screen SQL is never sent
here. Values remain DB-API parameters and identifiers come from validated metadata.
"""
import queue
import re
import threading
import time
from contextlib import contextmanager

import pymssql
from fastapi import HTTPException
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from . import sql_store as shared


class SqlServerSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="EDUNEXA_MSSQL_", env_file=".env", extra="ignore")
    host: str
    port: int = Field(default=1433, ge=1, le=65535)
    name: str
    user: str
    password: SecretStr
    db_schema: str = Field(default="dbo", pattern=r"^[a-z_][a-z0-9_]{0,62}$")
    encryption: str = Field(default="require", pattern=r"^(require|strict)$")
    connect_timeout: int = Field(default=10, ge=1, le=60)
    query_timeout: int = Field(default=30, ge=1, le=300)


def identifier(value):
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,127}", value):
        raise ValueError("Invalid database identifier")
    return f"[{value}]"


def database_error(exc):
    number = exc.args[0] if exc.args else None
    if number in {2601, 2627}:
        return HTTPException(409, "A record with the same unique value already exists")
    if number in {547, 515, 50000}:
        return HTTPException(409, "Change conflicts with a database rule")
    if number in {1205, 1222}:
        return HTTPException(503, "The database is busy; try again")
    return None


# The session emits simple parameterized SQL with unqualified table names. Only table
# positions are qualified here, allowing independent schemas without changing login defaults.
TABLE_POSITION = re.compile(r"\b(FROM|JOIN|INTO|UPDATE)\s+([a-z_][a-z0-9_]*)(?![a-z0-9_\[\].])", re.I)


class Cursor:
    def __init__(self, raw, schema):
        self.raw, self.schema = raw, schema

    def execute(self, query, params=None):
        query = TABLE_POSITION.sub(lambda m: f"{m[1]} {identifier(self.schema)}.{identifier(m[2])}", query)
        self.raw.execute(query, params)
        # pymssql can surface a later statement's constraint error only through nextset().
        # Flush batches must be completely consumed before a transaction can commit.
        if not query.lstrip().upper().startswith(("SELECT", "WITH", "DECLARE")):
            while self.raw.nextset():
                pass
        return self

    def __getattr__(self, name):
        return getattr(self.raw, name)


class Connection:
    def __init__(self, raw, schema):
        self.raw, self.schema = raw, schema
        self._autocommit = False

    @property
    def autocommit(self):
        return self._autocommit

    @autocommit.setter
    def autocommit(self, value):
        self.raw.autocommit(value)
        self._autocommit = value

    def cursor(self):
        return Cursor(self.raw.cursor(), self.schema)

    def commit(self):
        self.raw.commit()

    def rollback(self):
        self.raw.rollback()

    def close(self):
        self.raw.close()


def connect(settings=None):
    settings = settings or SqlServerSettings()
    raw = pymssql.connect(
        server=settings.host, port=str(settings.port), user=settings.user,
        password=settings.password.get_secret_value(), database=settings.name,
        login_timeout=settings.connect_timeout, timeout=settings.query_timeout,
        encryption=settings.encryption, tds_version="7.4", use_datetime2=True,
        appname="edunexa-backend",
    )
    raw.cursor().execute("SET NOCOUNT ON; SET XACT_ABORT ON; SET LOCK_TIMEOUT 30000;")
    return Connection(raw, settings.db_schema)


TYPES = {
    "bit": "bool", "tinyint": "int2", "smallint": "int2", "int": "int4", "bigint": "int8",
    "decimal": "numeric", "numeric": "numeric", "money": "numeric", "smallmoney": "numeric",
    "date": "date", "time": "time", "datetime": "timestamptz", "datetime2": "timestamptz",
    "datetimeoffset": "timestamptz", "smalldatetime": "timestamptz",
}


class Metadata(shared.Metadata):
    dialect = "sqlserver"

    def __init__(self, cur, schema, contract_fields):
        from .resources import CATALOG
        self.schema, self.tables = schema, {}
        cur.execute(
            "SELECT t.name, c.name, ty.name, c.is_nullable, c.is_identity"
            " FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id"
            " JOIN sys.columns c ON c.object_id=t.object_id"
            " JOIN sys.types ty ON ty.user_type_id=c.user_type_id"
            " WHERE s.name=%s ORDER BY t.name,c.column_id", (schema,))
        for table, column, actual_type, nullable, identity in cur.fetchall():
            logical = next((f["type"] for f in CATALOG.get(table, {}).get("fields", []) if f["name"] == column), None)
            json_column = logical in {"json", "jsonb", "ARRAY"} or bool(logical and logical.endswith("[]"))
            json_column |= (table, column) in {
                ("record_extras", "data"), ("users", "allowed_clients"),
                ("form_definitions", "fields"), ("form_submissions", "definition"),
                ("form_submissions", "submitted_values"), ("import_jobs", "errors"),
                ("import_jobs", "staged_rows"), ("payments", "request"),
            }
            typ = "jsonb" if json_column else TYPES.get(actual_type, "text")
            self.tables.setdefault(table, shared.Table(table)).columns[column] = shared.Column(column, typ, bool(nullable), bool(identity))
        cur.execute(
            "SELECT t.name,c.name,pt.name,pc.name"
            " FROM sys.foreign_key_columns fk JOIN sys.tables t ON t.object_id=fk.parent_object_id"
            " JOIN sys.schemas s ON s.schema_id=t.schema_id"
            " JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=fk.parent_column_id"
            " JOIN sys.tables pt ON pt.object_id=fk.referenced_object_id"
            " JOIN sys.columns pc ON pc.object_id=pt.object_id AND pc.column_id=fk.referenced_column_id"
            " WHERE s.name=%s", (schema,))
        for table, column, parent, parent_column in cur.fetchall():
            self.tables[table].fks.append((column, parent, parent_column))
        for table in self.tables.values():
            hidden = {"id"} if table.name in shared.Session.backing else shared.SYSTEM_COLUMNS - contract_fields.get(table.name, set())
            table.visible = set(table.columns) - hidden
        self.order = self._order()


class Pool(shared.Pool):
    def get(self):
        while True:
            try:
                connection, last = self.idle.get_nowait()
            except queue.Empty:
                return connect(self.settings)
            if time.monotonic() - last < 60:
                return connection
            try:
                connection.cursor().execute("SELECT 1").fetchall()
                return connection
            except pymssql.Error:
                shared._close(connection)


class SqlServerStore(shared.PostgresStore):
    def __init__(self, settings=None):
        self.settings = settings or SqlServerSettings()
        self.schema, self.pool = self.settings.db_schema, Pool(self.settings)
        self.open_snapshots = []
        self._metadata = None
        self._metadata_lock = threading.Lock()

    def _meta(self, connection):
        with self._metadata_lock:
            if self._metadata is None:
                self._metadata = Metadata(connection.cursor(), self.schema, shared._contract_fields())
            return self._metadata

    @contextmanager
    def transaction(self, prepare=None):
        connection = self.pool.get()
        connection.autocommit = False
        try:
            cur = connection.cursor()
            cur.execute(
                "DECLARE @result int; EXEC @result=sys.sp_getapplock @Resource=%s,"
                " @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000; SELECT @result;",
                (f"edunexa-store:{self.schema}",))
            if cur.fetchone()[0] < 0:
                raise HTTPException(503, "The database is busy; try again")
            session = shared.Session(connection, self._meta(connection), writable=True)
            yield session
            if prepare:
                prepare(session)
            session.flush()
            connection.commit()
        except BaseException as exc:
            try:
                connection.rollback()
            finally:
                self.pool.put(connection)
            if isinstance(exc, pymssql.Error):
                error = database_error(exc)
                if error:
                    raise error from None
            raise
        else:
            self.pool.put(connection)
