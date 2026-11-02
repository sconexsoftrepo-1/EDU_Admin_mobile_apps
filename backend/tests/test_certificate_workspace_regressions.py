import shutil
import subprocess

import pytest
from fastapi import HTTPException

class MemoryS3:
    def __init__(self): self.files = {}
    def put(self, key, raw, mime): self.files[key] = raw
    def delete(self, key): self.files.pop(key, None)
    def metadata(self, key): return {"storage_provider": "s3", "s3_bucket": "test", "s3_key": key, "s3_uri": "s3://test/" + key}

@pytest.fixture
def certificate_data(app):
    app.state.settings.file_storage = 's3'
    app.state.files = MemoryS3()
    with app.state.store.transaction() as d:
        for table, items in {
            'programs': {'P': {'code': 'P', 'name': 'Intermediate MPC'}},
            'academic_years': {'Y': {'code': 'Y', 'name': '2026–2028', 'program_code': 'P'}},
            'batches': {'B': {'code': 'B', 'program_code': 'P', 'academic_year_code': 'Y'}},
            'sections': {'SEC': {'code': 'SEC', 'batch_code': 'B'}},
            'students': {'S': {'code': 'S', 'first_name': 'Test', 'last_name': 'Student', 'admission_number': 'TEST001'}},
            'student_enrollments': {'E': {'code': 'E', 'student_code': 'S', 'section_code': 'SEC', 'status': 'active', 'roll_number': '001'}},
        }.items(): d['records'].setdefault(table, {}).update(items)
    return {'student_code': 'S', 'template_code': 'achievement', 'program_code': 'P', 'academic_year_code': 'Y'}

@pytest.mark.parametrize('template', ['study_certificate', 'conduct_certificate', 'attendance_certificate', 'course_completion', 'achievement'])
def test_preview_is_real_pdf_without_issuing(client, app, headers, certificate_data, template):
    before = app.state.store.snapshot()
    response = client.post('/api/v1/certificates/workspace/preview', headers=headers, json={**certificate_data, 'template_code': template})
    assert response.status_code == 200, response.text
    assert response.headers['content-type'] == 'application/pdf'
    assert response.headers['cache-control'] == 'no-store'
    assert response.content.startswith(b'%PDF') and b'/Subtype /Image' in response.content
    if shutil.which('pdftotext'):
        text = subprocess.check_output(['pdftotext', '-', '-'], input=response.content).decode()
        assert 'PREVIEW - NOT ISSUED' in text and 'Test Student' in text
    assert app.state.store.snapshot() == before and not app.state.files.files
    assert not (app.state.settings.data_dir / 'certificate-ed25519.key').exists()


def test_unlinked_system_requires_explicit_valid_issuer(client, app, headers, certificate_data):
    with app.state.store.transaction() as d: d['accounts']['ADMIN'].update(person_type='system', person_code='BOOTSTRAP')
    before = app.state.store.snapshot()
    for issuer, expected in [(None, 409), ('missing', 409), ('ADMIN-EMP', 201)]:
        response = client.post('/api/v1/certificates/workspace/issue', headers=headers, json={**certificate_data, 'issuer_employee_code': issuer})
        assert response.status_code == expected, response.text
        if expected == 409: assert app.state.store.snapshot() == before and not app.state.files.files
    current = app.state.store.snapshot()
    certificate = next(iter(current['records']['certificates'].values()))
    signature = next(iter(current['records']['certificate_signatures'].values()))
    assert certificate['issued_by_code'] == signature['signed_by_employee_code'] == 'ADMIN-EMP'


def test_upload_failure_rolls_back_request(client, app, headers, certificate_data):
    before = app.state.store.snapshot()
    def unavailable(*args): raise HTTPException(503, 'Storage unavailable')
    app.state.files.put = unavailable
    response = client.post('/api/v1/certificates/workspace/issue', headers=headers, json=certificate_data)
    assert response.status_code == 503 and app.state.store.snapshot() == before


def test_preview_rejects_wrong_course_or_issuer(client, headers, certificate_data):
    for patch, status in [({'program_code': 'other'}, 422), ({'issuer_employee_code': 'other'}, 403)]:
        response = client.post('/api/v1/certificates/workspace/preview', headers=headers, json={**certificate_data, **patch})
        assert response.status_code == status
