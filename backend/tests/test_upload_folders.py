import base64

from app.core.assignment_workspace import upload_key
from tests.test_lab_workspace import seed


def test_uploads_go_to_each_persons_own_folder(app):
    seed(app)
    data = app.state.store.snapshot()
    student = next(iter(data['records']['students'].values()))
    teacher = next(iter(data['records']['teachers'].values()))
    employee = data['records']['employees'][teacher['employee_code']]
    record = {'code': 'AFILE-1', 'assignment_code': 'ASG-9'}

    submitted = upload_key(data, {'person_type': 'student', 'person_code': student['code']}, record, 'application/pdf')
    assert submitted.startswith(f"Students/{student['admission_number']}/{student['code']}/Assignment_Submissions/ASG-9/")
    assert submitted.endswith('.pdf')

    handout = upload_key(data, {'person_type': 'employee', 'person_code': employee['code']}, record, 'image/png')
    assert handout.startswith('Teaching_Staff/') and f"/{employee['code']}/Assignments/ASG-9/" in handout

    syllabus = upload_key(data, {'person_type': 'employee', 'person_code': employee['code']},
                          {'code': 'AFILE-2', 'resource_upload': True}, 'application/pdf')
    assert '/Syllabus/' in syllabus
    event = upload_key(data, {'person_type': 'employee', 'person_code': employee['code']},
                       {'code': 'AFILE-3', 'event_upload': True}, 'image/jpeg')
    assert event.startswith('College/Calendar/')


def test_finished_assessment_upload_is_stored_under_the_uploader(client, headers, app):
    files = '/api/v1/academics/assignment-workspace/files'
    raw = b'%PDF-1.4\n%%EOF'
    code = client.post(files + '/start', headers=headers,
                       json={'filename': 'paper.pdf', 'size_bytes': len(raw), 'assessment_upload': True}).json()['code']
    client.post(f'{files}/{code}/chunk', headers=headers, json={'index': 0, 'content_base64': base64.b64encode(raw).decode()})
    assert client.post(f'{files}/{code}/finish', headers=headers).status_code == 200
    stored = app.state.store.snapshot()['documents']['assignment_files'][code]['storage_key']
    assert '/Assessments/' in stored and not stored.startswith('Uploads_In_Progress')
