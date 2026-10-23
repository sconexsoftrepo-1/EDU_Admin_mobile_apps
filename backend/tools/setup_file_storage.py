"""Create the private Supabase Storage bucket used with EDUNEXA_FILE_STORAGE=supabase.

Reads EDUNEXA_SUPABASE_URL, EDUNEXA_SUPABASE_SERVICE_ROLE_KEY and EDUNEXA_SUPABASE_BUCKET (default
edunexa-private) from the environment or .env. The bucket is private: files are read and written
only by the backend with the service role key.

    python tools/setup_file_storage.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.files import SupabaseFiles


class StorageSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="EDUNEXA_", env_file=".env", extra="ignore")
    supabase_url: str
    supabase_service_role_key: str
    supabase_bucket: str = "edunexa-private"


def main():
    s = StorageSettings()
    created = SupabaseFiles(s.supabase_url, s.supabase_service_role_key, s.supabase_bucket).ensure_bucket()
    print(f"Bucket {s.supabase_bucket} {'created (private)' if created else 'already exists'}")


if __name__ == "__main__":
    main()
