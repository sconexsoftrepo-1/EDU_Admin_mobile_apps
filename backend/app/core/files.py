"""Private file storage for uploads, imports and issued certificates.

Local development files, private Supabase buckets and private S3 objects share the same
put/get/delete interface. Only server-generated validated keys become object paths.
"""

import os
import re
from pathlib import Path

import httpx
from fastapi import HTTPException

_KEY = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,199}$")


def check_key(key) -> str:
    if not key or not all(_KEY.fullmatch(part) for part in str(key).split("/")) or ".." in str(key):
        raise HTTPException(404, "File unavailable")
    return str(key)


class LocalFiles:
    def __init__(self, root: Path):
        self.root = root

    def put(self, key: str, raw: bytes, mime: str) -> None:
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        path = self.root / check_key(key)
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with open(path, "xb") as out:  # keys are unique; never overwrite
            out.write(raw)
        path.chmod(0o600)

    def get(self, key: str) -> bytes | None:
        path = self.root / check_key(key)
        return path.read_bytes() if path.exists() else None

    def delete(self, key: str) -> None:
        (self.root / check_key(key)).unlink(missing_ok=True)


class S3Files:
    """Private S3 objects; credentials come from settings or the AWS credential chain."""

    def __init__(self, settings, client=None):
        import boto3
        from botocore.config import Config
        self.bucket = settings.s3_bucket_name
        self.prefix = check_key(settings.s3_prefix.strip("/"))
        options = {}
        if settings.s3_access_key:
            options.update(aws_access_key_id=settings.s3_access_key.get_secret_value(),
                           aws_secret_access_key=settings.s3_secret_key.get_secret_value())
        if settings.s3_session_token:
            options["aws_session_token"] = settings.s3_session_token.get_secret_value()
        self.client = client or boto3.client("s3", region_name=settings.s3_region,
            config=Config(signature_version="s3v4", connect_timeout=8, read_timeout=30,
                          retries={"max_attempts": 2}), **options)

    def object_key(self, key):
        key = check_key(key)
        return key if key.startswith(self.prefix + "/") else self.prefix + "/" + key

    def metadata(self, key):
        key = self.object_key(key)
        return {"storage_provider": "s3", "s3_bucket": self.bucket,
                "s3_key": key, "s3_uri": f"s3://{self.bucket}/{key}"}

    def _call(self, operation, **kwargs):
        from botocore.exceptions import BotoCoreError, ClientError
        try:
            return getattr(self.client, operation)(Bucket=self.bucket, **kwargs)
        except ClientError as exc:
            if operation == "get_object" and exc.response["Error"]["Code"] in {"NoSuchKey", "404"}:
                return None
            raise HTTPException(502, "S3 file operation failed") from None
        except BotoCoreError:
            raise HTTPException(503, "S3 file storage is unavailable") from None

    def put(self, key, raw, mime):
        return self._call("put_object", Key=self.object_key(key), Body=raw,
                          ContentType=mime, ServerSideEncryption="AES256", IfNoneMatch="*")

    def get(self, key):
        result = self._call("get_object", Key=self.object_key(key))
        if result is None:
            return None
        try:
            return result["Body"].read()
        finally:
            result["Body"].close()

    def delete(self, key):
        self._call("delete_object", Key=self.object_key(key))

    def view_url(self, key):
        return self.client.generate_presigned_url("get_object",
            Params={"Bucket": self.bucket, "Key": self.object_key(key)}, ExpiresIn=300)


class SupabaseFiles:
    def __init__(self, url: str, service_key: str, bucket: str, timeout: float = 30.0):
        self.base = url.rstrip("/") + "/storage/v1"
        self.bucket = bucket
        self.headers = {"Authorization": f"Bearer {service_key}", "apikey": service_key}
        self.timeout = timeout

    def _object(self, key: str) -> str:
        return f"{self.base}/object/{self.bucket}/{check_key(key)}"

    def put(self, key: str, raw: bytes, mime: str) -> None:
        response = httpx.post(self._object(key), content=raw, timeout=self.timeout,
                              headers={**self.headers, "Content-Type": mime, "x-upsert": "false"})
        if response.status_code >= 300:
            raise HTTPException(502, f"File storage rejected the upload ({response.status_code})")

    def get(self, key: str) -> bytes | None:
        response = httpx.get(self._object(key), headers=self.headers, timeout=self.timeout)
        if response.status_code in (400, 404):
            return None
        if response.status_code >= 300:
            raise HTTPException(502, f"File storage is unavailable ({response.status_code})")
        return response.content

    def delete(self, key: str) -> None:
        response = httpx.delete(self._object(key), headers=self.headers, timeout=self.timeout)
        if response.status_code not in (200, 204, 404):
            raise HTTPException(502, "File storage rejected the deletion")

    def ensure_bucket(self) -> bool:
        """Create the private bucket when missing; True when it was created."""
        found = httpx.get(f"{self.base}/bucket/{self.bucket}", headers=self.headers, timeout=self.timeout)
        if found.status_code == 200:
            return False
        made = httpx.post(f"{self.base}/bucket", headers=self.headers, timeout=self.timeout,
                          json={"id": self.bucket, "name": self.bucket, "public": False,
                                "file_size_limit": 5 * 1024 * 1024})
        if made.status_code >= 300:
            raise RuntimeError(f"Could not create bucket {self.bucket}: {made.status_code} {made.text}")
        return True


class UnconfiguredFiles:
    """Serverless deployment without file storage: file endpoints explain what to configure."""

    message = ("File storage is not configured: set EDUNEXA_FILE_STORAGE=s3 with S3 credentials "
               "or configure private Supabase storage")

    def put(self, key: str, raw: bytes, mime: str) -> None:
        raise HTTPException(503, self.message)

    def get(self, key: str) -> bytes | None:
        raise HTTPException(503, self.message)


def files_for(settings):
    if settings.file_storage == "s3":
        return S3Files(settings)
    if settings.file_storage == "supabase":
        return SupabaseFiles(settings.supabase_url, settings.supabase_service_role_key.get_secret_value(),
                             settings.supabase_bucket)
    if os.environ.get("VERCEL"):  # local disk does not persist on Vercel
        return UnconfiguredFiles()
    return LocalFiles(settings.data_dir / "files")
