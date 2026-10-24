import os
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="EDUNEXA_", env_file=".env", extra="ignore"
    )
    # Vercel's filesystem is read-only except /tmp (and /tmp does not persist between requests).
    data_dir: Path = Field(
        default_factory=lambda: Path("/tmp/edunexa") if os.environ.get("VERCEL") else Path("var")
    )
    jwt_secret: str = Field(min_length=48)
    sms_adapter_url: str | None = None
    sms_adapter_token: SecretStr | None = None
    payment_adapter_url: str | None = None
    payment_adapter_token: SecretStr | None = None
    payment_callback_secret: SecretStr | None = None
    public_api_url: str = "http://localhost:8010"
    issuer: str = "edunexa-api"
    audience: str = "edunexa-clients"
    access_minutes: int = Field(default=10, ge=1, le=30)
    refresh_days: int = Field(default=7, ge=1, le=30)
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:3012"]
    # postgres uses EDUNEXA_DB_*; sqlserver uses EDUNEXA_MSSQL_*; local-json is offline storage.
    storage_backend: Literal["local-json", "postgres", "sqlserver"] = "local-json"
    public_portal_url: str = "http://localhost:3000"
    # Private files: "local" = <data_dir>/files; "supabase" = a private Supabase Storage bucket.
    file_storage: Literal["local", "supabase"] = "local"
    supabase_url: str | None = None
    supabase_service_role_key: SecretStr | None = None
    supabase_bucket: str = "edunexa-private"
    # Base64 of the 32-byte Ed25519 private key that signs certificates (python
    # tools/generate_signing_key.py). Without it a local key file in data_dir is used.
    certificate_signing_key: SecretStr | None = None

    def model_post_init(self, context):
        if self.jwt_secret.startswith("replace-"):
            raise ValueError("Generate a private random JWT secret before starting")
        if self.file_storage == "supabase" and not (self.supabase_url and self.supabase_service_role_key):
            raise ValueError("EDUNEXA_FILE_STORAGE=supabase needs EDUNEXA_SUPABASE_URL and EDUNEXA_SUPABASE_SERVICE_ROLE_KEY")
        if os.environ.get("VERCEL"):
            # Serverless: nothing on local disk survives. Records must be in remote SQL storage; files and
            # the signing key are optional at start-up (their endpoints answer 503 until configured).
            if self.storage_backend not in {"postgres", "sqlserver"}:
                raise ValueError("Vercel deployment needs EDUNEXA_STORAGE_BACKEND=postgres or sqlserver")
            if not str(self.data_dir).startswith("/tmp"):
                self.data_dir = Path("/tmp/edunexa")  # e.g. a local path copied from .env
