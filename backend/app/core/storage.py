"""Atomic local development store; no SQL connections, migrations or table creation."""

import copy
import json
import os
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from filelock import FileLock


def now():
    return datetime.now(timezone.utc).isoformat()


_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"  # Crockford base32: no I, L, O or U


def new_code(prefix="REC"):
    """Short unique code such as NOTICE-7K3QH9XM2PRA (60 random bits)."""
    bits = uuid4().int
    return f"{prefix}-" + "".join(_ALPHABET[(bits >> (5 * i)) & 31] for i in range(12))


def next_number(values, prefix, width=4, taken=()):
    """PREFIX-<n> one past the highest PREFIX-<number> in values, skipping anything in taken."""
    start = len(prefix) + 1
    top = max((int(v[start:]) for v in values if isinstance(v, str) and v.startswith(f"{prefix}-") and v[start:].isdigit()),
              default=0)
    code = f"{prefix}-{top + 1:0{width}d}"
    while code in taken:  # a code taken by hand (or a concurrent save) moves the number on
        top += 1
        code = f"{prefix}-{top + 1:0{width}d}"
    return code


def next_code(rows, prefix, width=4):
    """Next number in a table's sequence, such as STU-0049, after the highest PREFIX-<number>."""
    codes = rows.codes_like(f"{prefix}-") if hasattr(rows, "codes_like") else rows
    return next_number(codes, prefix, width, taken=rows)


class Store:
    def __init__(self, directory: Path):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = self.directory / "development.json"
        self.lock = self.directory / ".lock"

    @contextmanager
    def transaction(self):
        # FileLock selects native Windows or Unix locking for the same sidecar path.
        with FileLock(str(self.lock), mode=0o600):
            data = (
                json.loads(self.path.read_text(encoding="utf-8"))
                if self.path.exists()
                else {
                    "records": {},
                    "accounts": {},
                    "roles": {},
                    "sessions": {},
                    "audit": [],
                    "forms": {},
                    "submissions": {},
                    "login_attempts": {},
                }
            )
            yield data
            tmpfd, name = tempfile.mkstemp(dir=self.directory)
            try:
                # Close the temporary file before os.replace: Windows forbids replacing an open file.
                with os.fdopen(tmpfd, "w", encoding="utf-8") as out:
                    json.dump(data, out, ensure_ascii=False, allow_nan=False)
                    out.flush()
                    os.fsync(out.fileno())
                os.replace(name, self.path)
            finally:
                if os.path.exists(name):
                    os.unlink(name)

    def snapshot(self):
        with self.transaction() as data:
            return copy.deepcopy(data)


def audit(data, actor, action, resource, code):
    # Deliberately excludes credentials, tokens, request bodies and student PII.
    data["audit"].append(
        {
            "code": new_code("AUD"),
            "actor": actor,
            "action": action,
            "resource": resource,
            "entity_code": code,
            "occurred_at": now(),
        }
    )
