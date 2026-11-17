"""Verify SQL schema and a temporary Blob round-trip using stage-only credentials."""
import json
from pathlib import Path
import sys
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from app.core.sqlserver import SqlServerSettings, connect
from app.core.settings import Settings
from app.core.files import AzureBlobFiles


def main():
    private = json.loads((Path(__file__).parent / "out/stage/private-settings.json").read_text())
    assert private["EDUNEXA_MSSQL_NAME"] == "edu_stage"
    assert private["EDUNEXA_AZURE_STORAGE_ACCOUNT"] == "pragathiedustage"
    db = SqlServerSettings(_env_file=None, host=private["EDUNEXA_MSSQL_HOST"], name="edu_stage",
                          user="edunexa_stage", password=private["EDUNEXA_MSSQL_PASSWORD"])
    conn = connect(db)
    try:
        cur = conn.cursor()
        cur.execute("SELECT DB_NAME()")
        assert cur.fetchone()[0] == "edu_stage"
        cur.execute("SELECT type, COUNT(*) FROM sys.objects WHERE is_ms_shipped=0 GROUP BY type")
        counts = {kind.strip(): count for kind, count in cur.fetchall()}
        assert counts.get("U") == 150 and counts.get("V") == 5 and counts.get("TR") == 162, counts
        print("edu_stage verified: 150 tables, 5 views, 162 triggers")
        cur.execute("SELECT COUNT(*) FROM dbo.users u JOIN dbo.user_roles ur ON ur.user_code=u.code JOIN dbo.roles r ON r.code=ur.role_code WHERE u.is_active=1 AND r.is_system_admin=1")
        assert cur.fetchone()[0] >= 1
        print("Active stage administrator exists")
    finally:
        conn.close()
    files = AzureBlobFiles(Settings(_env_file=None, jwt_secret=private["EDUNEXA_JWT_SECRET"],
        file_storage="azure", azure_storage_account="pragathiedustage",
        azure_storage_key=private["EDUNEXA_AZURE_STORAGE_KEY"], azure_storage_container="edu-stage"))
    key = "STAGE-VALIDATION-" + uuid4().hex
    raw = b"Isolated stage storage verification; no production data."
    files.put(key, raw, "text/plain")
    try:
        assert files.get(key) == raw
        print("Private staging Blob upload/download round-trip passed")
    finally:
        files.delete(key)
    assert files.get(key) is None
    print("Temporary verification object removed")


if __name__ == "__main__":
    main()
