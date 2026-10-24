"""Atomic local development store; no SQL connections, migrations or table creation."""

import copy
import fcntl
import json
import os
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def now():
    return datetime.now(timezone.utc).isoformat()


def new_code(prefix="REC"):
    return f"{prefix}-{uuid4().hex}"


class Store:
    def __init__(self, directory: Path):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = self.directory / "development.json"
        self.lock = self.directory / ".lock"

    @contextmanager
    def transaction(self):
        fd = os.open(self.lock, os.O_CREAT | os.O_RDWR, 0o600)
        with os.fdopen(fd, "a+") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            data = (
                json.loads(self.path.read_text())
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
            try:
                yield data
                tmpfd, name = tempfile.mkstemp(dir=self.directory)
                try:
                    with os.fdopen(tmpfd, "w") as out:
                        json.dump(data, out, ensure_ascii=False, allow_nan=False)
                        out.flush()
                        os.fsync(out.fileno())
                    os.replace(name, self.path)
                finally:
                    if os.path.exists(name):
                        os.unlink(name)
            finally:
                fcntl.flock(lock, fcntl.LOCK_UN)

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
