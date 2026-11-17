"""Apply an optional, private CI bootstrap secret to the stage backend only."""
import json
import os
from pathlib import Path
import subprocess
import tempfile

SUBSCRIPTION = "fa7aff08-db6d-4b24-bb39-95dff95cf969"


def validate(rows):
    values = {r["name"]: r["value"] for r in rows}
    if len(values) != len(rows):
        raise ValueError("Duplicate setting names")
    expected = {
        "EDUNEXA_STORAGE_BACKEND": "sqlserver", "EDUNEXA_MSSQL_HOST": "pragathiedu.database.windows.net",
        "EDUNEXA_MSSQL_NAME": "edu_stage", "EDUNEXA_MSSQL_USER": "edunexa_stage",
        "EDUNEXA_FILE_STORAGE": "azure", "EDUNEXA_AZURE_STORAGE_ACCOUNT": "pragathiedustage",
        "EDUNEXA_AZURE_STORAGE_CONTAINER": "edu-stage", "EDUNEXA_SEMESTER_REMINDERS_ENABLED": "false",
        "EDUNEXA_PUBLIC_API_URL": "https://edunexa-stage-api-pragathi.azurewebsites.net",
        "EDUNEXA_PUBLIC_PORTAL_URL": "https://stage.edu.pragathiews.org",
    }
    if any(values.get(k) != v for k, v in expected.items()):
        raise ValueError("Stage target validation failed")
    allowed = json.loads(values.get("EDUNEXA_EMAIL_ALLOWED_RECIPIENTS", "null"))
    if not isinstance(allowed, list) or not allowed or any(not isinstance(v, str) or "@" not in v for v in allowed):
        raise ValueError("Stage email must be restricted to an explicit login recipient list")
    for k in ("EDUNEXA_FCM_SERVICE_ACCOUNT_JSON",
              "EDUNEXA_FCM_SERVICE_ACCOUNT_FILE", "EDUNEXA_PUSH_ADAPTER_URL",
              "EDUNEXA_SMS_ADAPTER_URL", "EDUNEXA_PAYMENT_ADAPTER_URL"):
        if values.get(k):
            raise ValueError("Outbound integrations must remain off during initial bootstrap")
    return values


def main():
    raw = os.environ.get("EDUNEXA_STAGE_BOOTSTRAP_SETTINGS", "")
    if not raw:
        print("No bootstrap settings supplied; existing stage runtime configuration retained")
        return
    rows = json.loads(raw)
    validate(rows)
    fd, name = tempfile.mkstemp(prefix="edunexa-stage-", suffix=".json")
    try:
        with os.fdopen(fd, "w") as target:
            json.dump(rows, target)
        subprocess.run(["az", "webapp", "config", "appsettings", "set", "--subscription", SUBSCRIPTION,
                        "-g", "Pragathi", "-n", "edunexa-stage-api-pragathi", "--settings", "@" + name,
                        "--output", "none"], check=True)
    finally:
        Path(name).unlink(missing_ok=True)
    print("Validated settings applied to stage backend")


if __name__ == "__main__":
    main()
