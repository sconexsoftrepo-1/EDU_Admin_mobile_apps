"""Create the contained stage runtime user and first stage-only administrator.

Explicitly targets edu_stage; does not copy production users or business rows.
Private generated credentials are stored in ignored out/stage/private-settings.json.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import secrets
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from app.core.sqlserver import SqlServerSettings, connect


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-env", type=Path, required=True)
    args = parser.parse_args()
    admin = SqlServerSettings(_env_file=args.source_env)
    if admin.host != "pragathiedu.database.windows.net" or admin.name != "eduadmin":
        raise SystemExit("Unexpected source configuration")
    target = admin.model_copy(update={"name": "edu_stage"})
    out = Path(__file__).parent / "out/stage/private-settings.json"
    os.umask(0o077)
    if out.exists():
        private = json.loads(out.read_text())
        if private.get("EDUNEXA_MSSQL_NAME") != "edu_stage" or private.get("EDUNEXA_MSSQL_USER") != "edunexa_stage":
            raise SystemExit("Unexpected existing private settings")
    else:
        private = {
            "EDUNEXA_MSSQL_HOST": target.host, "EDUNEXA_MSSQL_NAME": "edu_stage",
            "EDUNEXA_MSSQL_USER": "edunexa_stage", "EDUNEXA_MSSQL_PASSWORD": secrets.token_urlsafe(48),
            "EDUNEXA_JWT_SECRET": secrets.token_urlsafe(64),
            "EDUNEXA_CERTIFICATE_SIGNING_KEY": base64.b64encode(secrets.token_bytes(32)).decode(),
            "EDUNEXA_AZURE_STORAGE_ACCOUNT": "pragathiedustage",
            "EDUNEXA_AZURE_STORAGE_CONTAINER": "edu-stage",
            "EDUNEXA_AZURE_STORAGE_KEY": "REPLACE_WITH_STAGE_STORAGE_KEY",
        }
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("x") as handle:
            json.dump(private, handle, indent=2)
    out.chmod(0o600)
    conn = connect(target)
    try:
        cur = conn.cursor()
        cur.execute("SELECT DB_NAME(), COUNT(*) FROM sys.tables")
        name, count = cur.fetchone()
        if name != "edu_stage" or count != 150:
            raise SystemExit("Expected the initialized edu_stage schema")
        cur.execute("SELECT COUNT(*) FROM sys.database_principals WHERE name = %s", ("edunexa_stage",))
        exists = cur.fetchone()[0]
        if not exists:
            password = private["EDUNEXA_MSSQL_PASSWORD"].replace("'", "''")
            cur.execute("CREATE USER [edunexa_stage] WITH PASSWORD=N'" + password + "'")
            cur.execute("ALTER ROLE db_datareader ADD MEMBER [edunexa_stage]")
            cur.execute("ALTER ROLE db_datawriter ADD MEMBER [edunexa_stage]")
            cur.execute("GRANT EXECUTE TO [edunexa_stage]")
            conn.commit()
    finally:
        conn.close()
    runtime = SqlServerSettings(_env_file=None, **{**target.model_dump(), "user": "edunexa_stage",
                               "password": private["EDUNEXA_MSSQL_PASSWORD"]})
    conn = connect(runtime)
    cur = conn.cursor()
    cur.execute("SELECT DB_NAME()")
    assert cur.fetchone()[0] == "edu_stage"
    conn.close()
    try:
        other = connect(runtime.model_copy(update={"name": "eduadmin"}))
    except Exception as exc:
        if not any(marker in str(exc).lower() for marker in ("login failed", "cannot open database", "18456", "4060")):
            raise SystemExit("Production denial check was inconclusive; investigate connectivity") from None
        print("Stage principal cannot connect to production database (expected)")
    else:
        other.close()
        raise SystemExit("Isolation failed: stage principal can connect to production")

    # Configure this process only; do not edit the production backend/.env.
    for key in ("HOST", "NAME", "USER", "PASSWORD"):
        os.environ["EDUNEXA_MSSQL_" + key] = private["EDUNEXA_MSSQL_" + key]
    os.environ["EDUNEXA_MSSQL_DB_SCHEMA"] = "dbo"
    from app.core.sqlserver import SqlServerStore
    from app.core.security import hasher
    from app.core.storage import new_code, audit
    store = SqlServerStore()
    try:
        with store.transaction() as data:
            if not any(r.get("system_admin") for r in data["roles"].values()):
                data["roles"]["STAGE-ADMIN"] = {"code": "STAGE-ADMIN", "name": "Stage Super Admin",
                    "system_admin": True, "scope": "college", "permissions": {}}
                code = new_code("USR")
                data["accounts"][code] = {"code": code, "login_id": "stage.admin", "active": True,
                    "person_type": "system", "person_code": code, "email": "kattachaitanya507@gmail.com",
                    "role_codes": ["STAGE-ADMIN"], "clients": ["admin-web", "admin-mobile"],
                    "password_hash": hasher.hash(secrets.token_urlsafe(48))}
                audit(data, code, "bootstrap", "accounts", code)
    finally:
        store.close()
    print("Stage runtime principal and stage.admin prepared; credentials were not printed")


if __name__ == "__main__":
    main()
