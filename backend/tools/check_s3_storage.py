"""Verify configured S3 read/write/delete access using a temporary object, then remove it."""
import sys
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.settings import Settings
from app.core.files import S3Files


def main():
    files = S3Files(Settings())
    key = f"Healthchecks/{uuid4().hex}.txt"
    raw = b"EduNexa private storage verification"
    files.put(key, raw, "text/plain")
    try:
        if files.get(key) != raw:
            raise RuntimeError("S3 read verification failed")
        print("S3 upload and read verified.")
    finally:
        files.delete(key)
    if files.get(key) is not None:
        raise RuntimeError("S3 delete verification failed")
    print("S3 deletion verified; temporary object removed.")


if __name__ == "__main__":
    main()
