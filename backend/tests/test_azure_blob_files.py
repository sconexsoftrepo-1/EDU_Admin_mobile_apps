"""Azure Blob storage: private container, same put/get/delete as the other stores."""
import base64
from types import SimpleNamespace

import pytest
from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
from fastapi import HTTPException
from pydantic import SecretStr

from app.core.files import AzureBlobFiles, files_for


class FakeContainer:
    def __init__(self):
        self.blobs = {}

    def upload_blob(self, name, raw, overwrite, content_settings):
        if name in self.blobs and not overwrite:
            raise ResourceExistsError("exists")
        self.blobs[name] = (raw, content_settings.content_type)

    def download_blob(self, name):
        if name not in self.blobs:
            raise ResourceNotFoundError("missing")
        return SimpleNamespace(readall=lambda: self.blobs[name][0])

    def delete_blob(self, name):
        if name not in self.blobs:
            raise ResourceNotFoundError("missing")
        del self.blobs[name]


def settings(**extra):
    return SimpleNamespace(file_storage="azure", azure_storage_container="edu", azure_storage_prefix="uploads",
                           azure_storage_account="pragathifiles",
                           azure_storage_key=SecretStr(base64.b64encode(b"k" * 32).decode()),
                           azure_storage_connection_string=None, **extra)


def test_files_round_trip_under_the_prefix_and_never_overwrite():
    container = FakeContainer()
    files = AzureBlobFiles(settings(), client=container)
    files.put("students/S1/photo.jpg", b"jpeg", "image/jpeg")
    assert container.blobs == {"uploads/students/S1/photo.jpg": (b"jpeg", "image/jpeg")}
    assert files.get("students/S1/photo.jpg") == b"jpeg"
    assert files.metadata("students/S1/photo.jpg") == {
        "storage_provider": "azure", "azure_container": "edu", "azure_blob": "uploads/students/S1/photo.jpg"}
    with pytest.raises(HTTPException) as again:
        files.put("students/S1/photo.jpg", b"other", "image/jpeg")
    assert again.value.status_code == 409
    files.delete("students/S1/photo.jpg")
    assert files.get("students/S1/photo.jpg") is None
    files.delete("students/S1/photo.jpg")  # already gone: no error


def test_unsafe_keys_are_refused():
    files = AzureBlobFiles(settings(), client=FakeContainer())
    for bad in ("../secret", "a/../../b", ""):
        with pytest.raises(HTTPException):
            files.put(bad, b"x", "text/plain")


def test_view_link_is_read_only_and_short_lived():
    files = AzureBlobFiles(settings(), client=FakeContainer())
    url = files.view_url("students/S1/photo.jpg")
    assert url.startswith("https://pragathifiles.blob.core.windows.net/edu/uploads/students/S1/photo.jpg?")
    assert "sp=r" in url and "se=" in url and "sig=" in url


def test_settings_choose_azure_and_explain_missing_credentials():
    assert isinstance(files_for(SimpleNamespace(**{**vars(settings())})), AzureBlobFiles)
    missing = settings()
    missing.azure_storage_key = None
    with pytest.raises(RuntimeError, match="EDUNEXA_AZURE_STORAGE_ACCOUNT"):
        AzureBlobFiles(missing)


def test_empty_azure_keys_keep_the_api_running_and_explain_on_file_use():
    from app.core.files import UnconfiguredFiles
    empty = settings()
    empty.azure_storage_account, empty.azure_storage_key = "", None
    files = files_for(empty)
    assert isinstance(files, UnconfiguredFiles)
    with pytest.raises(HTTPException) as refused:
        files.put("a.jpg", b"x", "image/jpeg")
    assert refused.value.status_code == 503 and "EDUNEXA_AZURE_STORAGE_ACCOUNT" in refused.value.detail
    files.delete("a.jpg")
