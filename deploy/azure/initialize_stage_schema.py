"""Extract schema only, review its deployment script, then initialize EMPTY edu_stage.

Never copies production rows or changes production. Private artifacts go under out/stage.
Requires an installed official SqlPackage executable and existing authorized source SQL settings.
"""
import argparse
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from app.core.sqlserver import SqlServerSettings, connect


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["extract", "script", "publish"])
    parser.add_argument("--sqlpackage", type=Path, required=True)
    parser.add_argument("--source-env", type=Path, required=True)
    args = parser.parse_args()
    source = SqlServerSettings(_env_file=args.source_env)
    if source.host != "pragathiedu.database.windows.net" or source.name != "eduadmin":
        raise SystemExit("Expected the verified source pragathiedu / eduadmin")
    target = source.model_copy(update={"name": "edu_stage"})
    out = Path(__file__).parent / "out/stage"
    out.mkdir(parents=True, exist_ok=True)
    os.umask(0o077)
    package = out / "schema-only.dacpac"
    command = [str(args.sqlpackage.resolve()), "/MaxParallelism:2"]
    if args.action == "extract":
        command += ["/Action:Extract", f"/TargetFile:{package}",
                    f"/SourceServerName:{source.host}", f"/SourceDatabaseName:{source.name}",
                    f"/SourceUser:{source.user}", f"/SourcePassword:{source.password.get_secret_value()}",
                    "/SourceEncryptConnection:True", "/SourceTrustServerCertificate:False",
                    "/p:ExtractAllTableData=False", "/p:ExtractReferencedServerScopedElements=False",
                    "/p:IgnorePermissions=True", "/p:IgnoreUserLoginMappings=True"]
    else:
        conn = connect(target)
        try:
            cur = conn.cursor()
            cur.execute("SELECT DB_NAME(), COUNT(*) FROM sys.tables")
            database, count = cur.fetchone()
            if database != "edu_stage" or count:
                raise SystemExit("Initialization requires an empty edu_stage database; no changes made")
        finally:
            conn.close()
        command += [f"/Action:{'Script' if args.action == 'script' else 'Publish'}", f"/SourceFile:{package}",
                    f"/TargetServerName:{target.host}", "/TargetDatabaseName:edu_stage",
                    f"/TargetUser:{target.user}", f"/TargetPassword:{target.password.get_secret_value()}",
                    "/TargetEncryptConnection:True", "/TargetTrustServerCertificate:False",
                    "/p:CreateNewDatabase=False", "/p:DropObjectsNotInSource=False",
                    "/p:BlockOnPossibleDataLoss=True", "/p:IgnorePermissions=True",
                    "/p:IgnoreRoleMembership=True", "/p:ScriptDatabaseOptions=False",
                    "/p:IgnorePreDeployScript=True", "/p:IgnorePostDeployScript=True",
                    "/p:ExcludeObjectTypes=Users;Logins;RoleMembership;Permissions;DatabaseRoles;DatabaseOptions"]
        if args.action == "script":
            command.append(f"/OutputPath:{out / 'initialize-schema.sql'}")
        elif not (out / "initialize-schema.sql").exists():
            raise SystemExit("Generate and review the stage script before publishing")
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    print(result.stdout.replace(source.password.get_secret_value(), "[REDACTED]"))
    if result.returncode:
        raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
