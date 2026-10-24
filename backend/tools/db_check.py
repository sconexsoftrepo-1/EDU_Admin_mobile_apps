"""Verify the PostgreSQL connection configured in .env and count existing objects."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.database import DatabaseSettings, connect


def main():
    settings = DatabaseSettings()
    conn = connect(settings)
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT current_setting('server_version'), current_database(), current_user,"
            " (SELECT COUNT(*) FROM pg_tables WHERE schemaname = %(s)s),"
            " (SELECT COUNT(*) FROM pg_views WHERE schemaname = %(s)s),"
            " (SELECT COUNT(*) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid"
            "   WHERE c.relnamespace = %(s)s::regnamespace AND NOT tg.tgisinternal)",
            {"s": settings.db_schema},
        )
        version, db, login, tables, views, triggers = cur.fetchone()
        migrations = []
        if tables:
            cur.execute("SELECT to_regclass('schema_migrations') IS NOT NULL")
            if cur.fetchone()[0]:
                cur.execute("SELECT version FROM schema_migrations ORDER BY version")
                migrations = [v for (v,) in cur.fetchall()]
    finally:
        conn.close()
    print(f"Connected to {settings.host}:{settings.port}/{db} as {login}")
    print(f"PostgreSQL {version}; schema {settings.db_schema}: {tables} tables, {views} views, "
          f"{triggers} triggers; migrations: {', '.join(migrations) or 'none'}")


if __name__ == "__main__":
    main()
