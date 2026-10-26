"""Install the private file inventory without changing existing document records.

Run from backend: .venv/bin/python tools/setup_s3_metadata.py
Uses the configured SQL Server/PostgreSQL database and is safe to run again.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.settings import Settings


def main():
    settings = Settings()
    if settings.storage_backend == "local-json":
        print("Local JSON stores the file inventory automatically.")
        return
    if settings.storage_backend == "sqlserver":
        from app.core.sqlserver import connect, SqlServerSettings
        db = SqlServerSettings()
        connection = connect(db)
        source = "sqlserver/012_file_storage_objects.sql"
        script = (Path(__file__).resolve().parents[2] / "database" / source).read_text()
        script = script.replace("dbo.", f"[{db.db_schema}].")
    else:
        from app.core.database import connect
        connection = connect()
        script = (Path(__file__).resolve().parents[2] / "database/file_storage_objects_postgresql.sql").read_text()
    try:
        connection.cursor().execute(script)
        connection.commit()
        print("File inventory table and owner index installed.")
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    main()
