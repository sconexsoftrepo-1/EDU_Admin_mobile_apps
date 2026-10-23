from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="EDUNEXA_", env_file=".env", extra="ignore"
    )
    data_dir: Path = Path("var")
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
    # "postgres" uses EDUNEXA_DB_* (see app/core/database.py); "local-json" keeps data in data_dir.
    storage_backend: Literal["local-json", "postgres"] = "local-json"
    public_portal_url: str = "http://localhost:3000"

    def model_post_init(self, context):
        if self.jwt_secret.startswith("replace-"):
            raise ValueError("Generate a private random JWT secret before starting")
