import base64
from io import BytesIO
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.core.files import LocalFiles, S3Files, check_key
from app.core.settings import Settings
from app.modules.documents.files.api import person_folder


def test_s3_scopes_private_objects_and_metadata():
    client = Mock()
    settings = Settings(_env_file=None, jwt_secret="x" * 64, file_storage="s3")
    store = S3Files(settings, client=client)
    key = "Students/ADM1/S1/student_photo/FILE-test.jpg"
    store.put(key, b"image", "image/jpeg")
    client.put_object.assert_called_once_with(Bucket="edu-admin-portal-file", Key="Admin_Uploads/" + key,
        Body=b"image", ContentType="image/jpeg", ServerSideEncryption="AES256", IfNoneMatch="*")
    body = BytesIO(b"image")
    client.get_object.return_value = {"Body": body}
    assert store.get(key) == b"image"
    assert body.closed
    assert store.metadata(key)["s3_uri"] == "s3://edu-admin-portal-file/Admin_Uploads/" + key
    store.delete(key)
    client.delete_object.assert_called_once_with(Bucket="edu-admin-portal-file", Key="Admin_Uploads/" + key)


@pytest.mark.parametrize("key", ["../file", "/etc/passwd", "x/../../file", "a//b", "a\\b", "a/./b", "a/%2e%2e/b"])
def test_file_keys_reject_traversal(key):
    with pytest.raises(HTTPException):
        check_key(key)


def test_local_store_supports_owner_folders(tmp_path):
    store = LocalFiles(tmp_path)
    store.put("Students/ADM1/photo/test.jpg", b"photo", "image/jpeg")
    assert store.get("Students/ADM1/photo/test.jpg") == b"photo"
    store.delete("Students/ADM1/photo/test.jpg")
    assert store.get("Students/ADM1/photo/test.jpg") is None


def test_staff_and_application_folders_are_separate():
    data = {"records": {"employees": {"E1": {"code": "E1", "employee_type": "teacher"}, "E2": {"code": "E2", "employee_type": "staff"}}, "admission_applications": {"A1": {"code": "A1", "application_number": "2026/001"}}}}
    assert person_folder(data, "employee_document", "E1") == "Teaching_Staff/E1/E1"
    assert person_folder(data, "form_16", "E2") == "Non_Teaching_Staff/E2/E2"
    assert person_folder(data, "admission_document", "A1").startswith("Applications/2026_001-")


def test_upload_view_delete_and_inventory(client, headers, seeded):
    raw = b"\xff\xd8\xffsample-image"
    result = client.post("/api/v1/documents/upload", headers=headers, json={
        "kind": "student_document", "person_code": "S1", "filename": "portrait.jpg",
        "document_label": "student_photo", "content_base64": base64.b64encode(raw).decode()})
    assert result.status_code == 201, result.text
    file = result.json()
    assert file["size_bytes"] == len(raw)
    code = file["code"]
    data = seeded.state.store.snapshot()
    inventory = data["records"]["file_storage_objects"][code]
    assert inventory["owner_code"] == "S1"
    assert inventory["storage_key"].startswith("Students/ADM1/S1/student_photo/")
    assert data["records"]["students"]["S1"]["profile_photo_url"] == file["document_url"]
    view = client.get(file["document_url"], headers=headers)
    assert view.content == raw
    assert view.headers["content-type"] == "image/jpeg"
    assert view.headers["content-disposition"].startswith("inline;")
    assert client.get(file["document_url"]).status_code == 401
    assert len(client.get("/api/v1/documents/files/student/S1", headers=headers).json()["items"]) == 1
    assert client.delete(f"/api/v1/documents/document/{code}/file", headers=headers).status_code == 200
    assert client.get(file["document_url"], headers=headers).status_code == 404
    assert client.get("/api/v1/documents/files/student/S1", headers=headers).json()["items"] == []
    assert seeded.state.files.get(inventory["storage_key"]) is None
    data = seeded.state.store.snapshot()
    assert data["records"]["file_storage_objects"][code]["deleted_at"]
    assert data["records"]["students"]["S1"]["profile_photo_url"] is None


def test_upload_rolls_back_object_when_metadata_write_fails(client, headers, seeded, monkeypatch):
    from app.modules.documents.files import api
    def fail(*args):
        raise RuntimeError("Simulated database failure")
    monkeypatch.setattr(api, "query_save", fail)
    with pytest.raises(RuntimeError, match="Simulated database failure"):
        client.post("/api/v1/documents/upload", headers=headers, json={
            "kind": "student_document", "person_code": "S1", "filename": "test.pdf",
            "content_base64": base64.b64encode(b"%PDF-1.4 test").decode()})
    assert not list((seeded.state.settings.data_dir / "files").rglob("*.pdf"))
    assert not seeded.state.store.snapshot()["records"].get("documents")


def test_unrelated_student_cannot_view_or_delete_file(client, headers, seeded):
    from tests.test_screen_workflows import mobile_login
    response = client.post("/api/v1/documents/upload", headers=headers, json={
        "kind": "student_document", "person_code": "S1", "filename": "test.pdf",
        "content_base64": base64.b64encode(b"%PDF-1.4 test").decode()})
    code = response.json()["code"]
    other = mobile_login(client, seeded, "student", "S2", "student-mobile")
    assert client.get(f"/api/v1/documents/document/{code}/view", headers=other).status_code == 404
    assert client.get("/api/v1/documents/files/student/S1", headers=other).json()["items"] == []
    assert client.delete(f"/api/v1/documents/document/{code}/file", headers=other).status_code == 403


def test_enrollment_photo_upload_sends_bytes_to_student_s3_folder(client, app, monkeypatch):
    from tests.test_master_data import master_data_user, wizard_student

    headers = master_data_user(app, client)
    course = client.post("/api/v1/master-data/actions/create-course", headers=headers, json={"values": {
        "program.code": "INT-MPC", "program.department_code": "DEP",
        "program.name": "Intermediate MPC", "program.qualification": "Intermediate",
        "program.duration_semesters": 4, "program.course_level": "intermediate", "program.branch": "MPC",
        "batch.code": "INT-MPC-2026", "batch.name": "2026-28", "batch.entry_year": 2026,
        "batch.graduation_year": 2028}})
    assert course.status_code == 201, course.text
    enrollment = client.post("/api/v1/master-data/enrollment", headers=headers, json=wizard_student())
    assert enrollment.status_code == 201, enrollment.text
    student = enrollment.json()["student"]

    # Exercise the actual enrollment photo API against the S3 adapter, without making an AWS request.
    s3 = Mock()
    settings = app.state.settings.model_copy(update={"file_storage": "s3"})
    monkeypatch.setattr(app.state, "settings", settings)
    monkeypatch.setattr(app.state, "files", S3Files(settings, client=s3))
    photo = b"\xff\xd8\xffenrollment-photo"
    uploaded = client.post("/api/v1/documents/upload", headers=headers, json={
        "kind": "student_document", "person_code": student["code"],
        "document_label": "student_photo", "filename": "student-photo.jpg",
        "content_base64": base64.b64encode(photo).decode()})
    assert uploaded.status_code == 201, uploaded.text
    file = uploaded.json()
    sent = s3.put_object.call_args.kwargs
    assert sent["Bucket"] == "edu-admin-portal-file"
    assert sent["Key"].startswith(f"Admin_Uploads/Students/{student['admission_number']}/{student['code']}/student_photo/")
    assert sent["Body"] == photo and sent["ContentType"] == "image/jpeg"

    data = app.state.store.snapshot()
    saved_student = data["records"]["students"][student["code"]]
    inventory = data["records"]["file_storage_objects"][file["code"]]
    assert inventory["s3_key"] == sent["Key"]
    assert inventory["s3_uri"] == "s3://edu-admin-portal-file/" + sent["Key"]
    assert saved_student["profile_photo_url"] == file["document_url"]
    assert saved_student["profile_photo_storage_key"] == data["records"]["documents"][file["code"]]["storage_key"]
    profile = next(p for p in data["records"]["student_admission_profiles"].values() if p["student_code"] == student["code"])
    assert profile["document_checklist"]["student_photo"]["uploaded"] is True

    s3.get_object.return_value = {"Body": BytesIO(photo)}
    viewed = client.get(file["document_url"], headers=headers)
    assert viewed.status_code == 200 and viewed.content == photo
