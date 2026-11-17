"""Generate stage settings from an explicit private JSON file, never backend/.env.

Use --input deploy/azure/out/stage/private-settings.json --api-url https://...
--admin-url https://stage.edu.pragathiews.org --extra-origin https://<stage default host>.
Secrets are supplied explicitly so repeated deployment does not rotate signing keys.
"""
import argparse
import base64
import json
import os
from pathlib import Path
from urllib.parse import urlparse

DOMAIN = "https://stage.edu.pragathiews.org"
REQUIRED = {
    "EDUNEXA_MSSQL_HOST", "EDUNEXA_MSSQL_NAME", "EDUNEXA_MSSQL_USER",
    "EDUNEXA_MSSQL_PASSWORD", "EDUNEXA_JWT_SECRET", "EDUNEXA_CERTIFICATE_SIGNING_KEY",
    "EDUNEXA_AZURE_STORAGE_ACCOUNT", "EDUNEXA_AZURE_STORAGE_KEY",
    "EDUNEXA_AZURE_STORAGE_CONTAINER",
}
OPTIONAL_EMAIL = {"EDUNEXA_EMAIL_CONNECTION_STRING", "EDUNEXA_EMAIL_SENDER"}
ALLOWLIST = "EDUNEXA_EMAIL_ALLOWED_RECIPIENTS"


def https_origin(value):
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        raise ValueError("An HTTPS origin without a path or credentials is required")
    return value.rstrip("/")


def build(values, api_url, admin_url=DOMAIN, extra_origins=()):
    if not REQUIRED.issubset(values) or set(values) - REQUIRED - OPTIONAL_EMAIL - {ALLOWLIST}:
        raise ValueError("Input must contain the stage template keys and only optional email settings")
    if set(values) & OPTIONAL_EMAIL and not OPTIONAL_EMAIL.issubset(values):
        raise ValueError("Supply both email settings or neither")
    allowed = json.loads(values.get(ALLOWLIST, '["kattachaitanya507@gmail.com"]'))
    if not isinstance(allowed, list) or not allowed or any(not isinstance(v, str) or "@" not in v for v in allowed):
        raise ValueError("Provide a non-empty explicit stage login email allowlist")
    if any(not isinstance(v, str) or not v.strip() or "REPLACE_" in v for v in values.values()):
        raise ValueError("Complete all private stage values before generating settings")
    if values["EDUNEXA_MSSQL_HOST"] != "pragathiedu.database.windows.net" or values["EDUNEXA_MSSQL_NAME"] != "edu_stage":
        raise ValueError("Stage must target pragathiedu / edu_stage")
    if values["EDUNEXA_MSSQL_USER"] != "edunexa_stage":
        raise ValueError("Use the dedicated edunexa_stage SQL principal")
    if values["EDUNEXA_AZURE_STORAGE_CONTAINER"] != "edu-stage":
        raise ValueError("Stage requires its own edu-stage private container")
    if len(values["EDUNEXA_JWT_SECRET"]) < 48:
        raise ValueError("Stage JWT secret must have at least 48 characters")
    try:
        key = base64.b64decode(values["EDUNEXA_CERTIFICATE_SIGNING_KEY"], validate=True)
    except (ValueError, TypeError) as exc:
        raise ValueError("Invalid stage signing key") from exc
    if len(key) != 32:
        raise ValueError("Stage signing key must decode to 32 bytes")
    api, admin = https_origin(api_url), https_origin(admin_url)
    if admin != DOMAIN or "stage" not in urlparse(api).hostname:
        raise ValueError("Use the requested stage domain and a stage API hostname")
    origins = [admin, *map(https_origin, extra_origins)]
    if any("stage" not in urlparse(origin).hostname for origin in origins):
        raise ValueError("Only stage browser origins are allowed")
    return {**values,
        "EDUNEXA_STORAGE_BACKEND": "sqlserver", "EDUNEXA_FILE_STORAGE": "azure",
        "EDUNEXA_MSSQL_PORT": "1433", "EDUNEXA_MSSQL_DB_SCHEMA": "dbo",
        "EDUNEXA_MSSQL_ENCRYPTION": "require", "EDUNEXA_DATA_DIR": "/home/data/edunexa",
        "EDUNEXA_AZURE_STORAGE_PREFIX": "uploads", "EDUNEXA_PUBLIC_API_URL": api,
        "EDUNEXA_PUBLIC_PORTAL_URL": admin, "EDUNEXA_CORS_ORIGINS": json.dumps(origins),
        "EDUNEXA_ISSUER": "edunexa-stage-api", "EDUNEXA_API_DOCS": "false",
        "EDUNEXA_STAFF_PASSWORD_LOGIN": "false", "EDUNEXA_SEMESTER_REMINDERS_ENABLED": "false",
        "EDUNEXA_EMAIL_CONNECTION_STRING": values.get("EDUNEXA_EMAIL_CONNECTION_STRING", ""),
        "EDUNEXA_EMAIL_SENDER": values.get("EDUNEXA_EMAIL_SENDER", ""),
        "EDUNEXA_EMAIL_ALLOWED_RECIPIENTS": json.dumps(allowed),
        "EDUNEXA_FCM_SERVICE_ACCOUNT_FILE": "", "EDUNEXA_FCM_SERVICE_ACCOUNT_JSON": "",
        "EDUNEXA_PUSH_ADAPTER_URL": "", "EDUNEXA_PUSH_ADAPTER_TOKEN": "",
        "EDUNEXA_SMS_ADAPTER_URL": "", "EDUNEXA_SMS_ADAPTER_TOKEN": "",
        "EDUNEXA_PAYMENT_ADAPTER_URL": "", "EDUNEXA_PAYMENT_ADAPTER_TOKEN": "",
        "EDUNEXA_PAYMENT_CALLBACK_SECRET": "", "EDUNEXA_STUDENT_APP_LINK": "",
        "SCM_DO_BUILD_DURING_DEPLOYMENT": "true", "WEBSITES_PORT": "8000", "TZ": "Asia/Kolkata"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "out/stage/backend-appsettings.json")
    parser.add_argument("--api-url", required=True)
    parser.add_argument("--admin-url", default=DOMAIN)
    parser.add_argument("--extra-origin", action="append", default=[])
    args = parser.parse_args()
    settings = build(json.loads(args.input.read_text()), args.api_url, args.admin_url, args.extra_origin)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.chmod(args.output, 0o600)
    with os.fdopen(fd, "w") as output:
        json.dump([{"name": k, "value": v, "slotSetting": False} for k, v in sorted(settings.items())], output, indent=2)
    print(f"Stage settings generated at {args.output}; values are not printed")


if __name__ == "__main__":
    main()
