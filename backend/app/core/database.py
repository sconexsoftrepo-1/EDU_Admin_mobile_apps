"""PostgreSQL (Supabase) connection settings. Credentials come only from the ignored .env file."""

import hashlib
from pathlib import Path

import psycopg
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="EDUNEXA_DB_", env_file=".env", extra="ignore", populate_by_name=True
    )
    host: str
    port: int = 5432
    name: str = "postgres"
    user: str
    password: SecretStr
    sslmode: str = "require"
    connect_timeout: int = 15
    # Schema holding the EduNexa tables; tests install isolated copies in their own schema.
    db_schema: str = Field(default="public", alias="EDUNEXA_DB_SCHEMA", pattern=r"^[a-z_][a-z0-9_]{0,62}$")


def connect(settings: DatabaseSettings | None = None, schema: str | None = None) -> psycopg.Connection:
    """Open a connection whose search_path is the EduNexa schema. Transactions are explicit.

    Statements use client-side parameter binding (values are escaped by libpq), so several
    parameterized statements can be sent in one round trip; SQL text uses %s / %(name)s markers.
    """
    settings = settings or DatabaseSettings()
    schema = schema or settings.db_schema
    return psycopg.connect(
        host=settings.host,
        port=settings.port,
        dbname=settings.name,
        user=settings.user,
        password=settings.password.get_secret_value(),
        sslmode=settings.sslmode,
        connect_timeout=settings.connect_timeout,
        application_name="edunexa-backend",
        options=f"-c search_path={schema}",
        cursor_factory=psycopg.ClientCursor,
    )


DATABASE_DIR = Path(__file__).resolve().parents[3] / "database"
SCHEMA_FILE = DATABASE_DIR / "edunexa_schema_postgresql.sql"
# Incremental changes for existing databases (NNN_name.sql), applied by tools/migrate.py.
MIGRATIONS_DIR = DATABASE_DIR / "migrations"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()
