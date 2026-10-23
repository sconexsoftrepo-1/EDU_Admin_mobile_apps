"""Generate a private local JWT secret without printing it or replacing existing config."""

import os
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / ".env"
try:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
except FileExistsError:
    raise SystemExit(".env already exists; retained without changes.")
with os.fdopen(fd, "w") as out:
    out.write("EDUNEXA_JWT_SECRET=" + secrets.token_urlsafe(64) + "\n")
    out.write("EDUNEXA_DATA_DIR=" + str(root / "var") + "\n")
    out.write("EDUNEXA_STORAGE_BACKEND=local-json\n")
print("Private local configuration created. Run tools/bootstrap_admin.py next.")
