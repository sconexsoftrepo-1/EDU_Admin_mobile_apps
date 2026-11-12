"""Turn backend/.env into the App Service settings file for the backend web app.

    backend/.venv/bin/python deploy/azure/make_backend_settings.py --api-url https://<api app>.azurewebsites.net \
        --admin-url https://<admin app>.azurewebsites.net

Writes deploy/azure/out/backend-appsettings.json (git-ignored: it holds secrets), used by
deploy.sh or pasted in the portal (web app > Settings > Environment variables > Advanced edit).
Local-only values (paths on this Mac) are replaced with App Service ones:
  - EDUNEXA_DATA_DIR -> /home/data/edunexa (the /home share survives restarts and deploys)
  - EDUNEXA_FCM_SERVICE_ACCOUNT_FILE -> the key's JSON in EDUNEXA_FCM_SERVICE_ACCOUNT_JSON
  - EDUNEXA_CERTIFICATE_SIGNING_KEY -> kept from .env, else made once and saved in backend/secrets/
"""
import argparse
import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
OUT = Path(__file__).resolve().parent / "out"


def read_env(path):
    values = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        values[key.strip()] = value
    return values


def signing_key(env):
    if env.get("EDUNEXA_CERTIFICATE_SIGNING_KEY"):
        return env["EDUNEXA_CERTIFICATE_SIGNING_KEY"]
    saved = BACKEND / "secrets" / "certificate-signing-key.txt"
    if saved.exists():
        return saved.read_text().strip()
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    raw = Ed25519PrivateKey.generate().private_bytes(
        serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
    key = base64.b64encode(raw).decode()
    saved.parent.mkdir(exist_ok=True)
    saved.write_text(key + "\n")
    saved.chmod(0o600)
    print(f"New certificate signing key saved to {saved} (keep it; certificates are verified with it)")
    return key


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--api-url", required=True, help="public URL of the backend web app")
    parser.add_argument("--admin-url", required=True, help="public URL of the admin dashboard web app")
    parser.add_argument("--extra-origin", action="append", default=[], help="another site allowed to call the API")
    args = parser.parse_args()

    env = read_env(BACKEND / ".env")
    settings = {k: v for k, v in env.items() if k.startswith("EDUNEXA_")}
    for local_only in ("EDUNEXA_DATA_DIR", "EDUNEXA_FCM_SERVICE_ACCOUNT_FILE"):
        settings.pop(local_only, None)

    key_file = env.get("EDUNEXA_FCM_SERVICE_ACCOUNT_FILE")
    if key_file and Path(key_file).exists():
        settings["EDUNEXA_FCM_SERVICE_ACCOUNT_JSON"] = json.dumps(json.loads(Path(key_file).read_text()), separators=(",", ":"))
    else:
        print("WARNING: no Firebase key file found; phone pushes stay off until EDUNEXA_FCM_SERVICE_ACCOUNT_JSON is set")

    api, admin = args.api_url.rstrip("/"), args.admin_url.rstrip("/")
    settings.update({
        "EDUNEXA_STORAGE_BACKEND": "sqlserver",
        "EDUNEXA_DATA_DIR": "/home/data/edunexa",
        "EDUNEXA_PUBLIC_API_URL": api,
        "EDUNEXA_PUBLIC_PORTAL_URL": admin,
        "EDUNEXA_CORS_ORIGINS": json.dumps([admin, *[o.rstrip("/") for o in args.extra_origin]]),
        "EDUNEXA_API_DOCS": "false",
        "EDUNEXA_CERTIFICATE_SIGNING_KEY": signing_key(env),
        # App Service: build the Python environment from requirements.txt on deploy, app port 8000.
        "SCM_DO_BUILD_DURING_DEPLOYMENT": "true",
        "WEBSITES_PORT": "8000",
        "TZ": "Asia/Kolkata",
    })
    missing = [k for k in ("EDUNEXA_JWT_SECRET", "EDUNEXA_MSSQL_HOST", "EDUNEXA_MSSQL_PASSWORD") if not settings.get(k)]
    if missing:
        raise SystemExit(f"backend/.env is missing {', '.join(missing)}")

    OUT.mkdir(exist_ok=True)
    target = OUT / "backend-appsettings.json"
    target.write_text(json.dumps([{"name": k, "value": v, "slotSetting": False} for k, v in sorted(settings.items())], indent=2))
    target.chmod(0o600)
    print(f"Wrote {len(settings)} settings to {target}")
    print("Names:", ", ".join(sorted(settings)))


if __name__ == "__main__":
    main()
