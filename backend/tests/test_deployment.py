import secrets

import httpx
import pytest

from app.core import files as files_module
from app.core.files import SupabaseFiles
from app.core.settings import Settings


def test_supabase_files_put_and_get(monkeypatch):
    stored = {}

    def fake_post(url, content=None, headers=None, timeout=None, json=None):
        assert headers["Authorization"] == "Bearer service-key" and headers["x-upsert"] == "false"
        stored[url] = (content, headers["Content-Type"])
        return httpx.Response(200)

    def fake_get(url, headers=None, timeout=None):
        return httpx.Response(200, content=stored[url][0]) if url in stored else httpx.Response(400)

    monkeypatch.setattr(files_module.httpx, "post", fake_post)
    monkeypatch.setattr(files_module.httpx, "get", fake_get)
    store = SupabaseFiles("https://demo.supabase.co/", "service-key", "edunexa-private")
    store.put("FILE-abc", b"%PDF-1.4", "application/pdf")
    assert list(stored) == ["https://demo.supabase.co/storage/v1/object/edunexa-private/FILE-abc"]
    assert store.get("FILE-abc") == b"%PDF-1.4"
    assert store.get("FILE-missing") is None
    with pytest.raises(Exception):
        store.get("../secrets")  # keys are server generated; paths are refused


def test_vercel_needs_postgres_and_starts_without_file_storage(monkeypatch):
    monkeypatch.setenv("VERCEL", "1")
    secret = secrets.token_urlsafe(64)
    with pytest.raises(ValueError, match="EDUNEXA_STORAGE_BACKEND=postgres"):
        Settings(_env_file=None, jwt_secret=secret)
    # A local data folder copied from .env is replaced by /tmp; files are optional at start-up.
    settings = Settings(_env_file=None, jwt_secret=secret, storage_backend="postgres", data_dir="/Users/me/var")
    assert str(settings.data_dir) == "/tmp/edunexa"
    store = files_module.files_for(settings)
    with pytest.raises(Exception, match="File storage is not configured"):
        store.put("FILE-1", b"x", "application/pdf")
    configured = Settings(_env_file=None, jwt_secret=secret, storage_backend="postgres", file_storage="supabase",
                          supabase_url="https://demo.supabase.co", supabase_service_role_key="k")
    assert isinstance(files_module.files_for(configured), SupabaseFiles)
