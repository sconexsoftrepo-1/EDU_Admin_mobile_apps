import pytest

BASE = '/api/v1/academics/programs'


@pytest.fixture(autouse=True)
def campus(app):
    with app.state.store.transaction() as data:
        data['records'].setdefault('campuses', {})['C'] = {'code': 'C', 'name': 'College'}


def course(**overrides):
    return dict(course_level='degree', qualification='BSc', branch='Applied Science',
                branch_code='APPSCI', duration_years=3, duration_semesters=4,
                semester_labels=['Foundation', 'Core', 'Advanced', 'Research'],
                subject_entries=[{'name': 'Physics', 'semester_number': 1, 'subject_type': 'theory'},
                                 {'name': 'Physics lab', 'semester_number': 2, 'subject_type': 'practical'}],
                details='Course details', **overrides)


def test_create_course_subjects_and_labels(client, headers, app):
    response = client.post(BASE, headers=headers, json=course())
    assert response.status_code == 201, response.text
    row = response.json()
    assert row['duration_label'] == '3 years'
    assert row['duration_semesters'] == 4
    from app.core.course_form import course_years
    assert course_years(row) == 3
    assert row['name'] == 'Degree · Applied Science'
    assert row['code'] == 'DEG-APPSCI'
    code = row['code']
    fetched = client.get(f'{BASE}/{code}', headers=headers).json()
    assert fetched['semester_labels'] == course()['semester_labels']
    workspace = client.get(f'/api/v1/academics/course-curricula/{code}/workspace', headers=headers)
    assert workspace.status_code == 200, workspace.text
    assert {(r['name'], r['semester_number'], r['subject_type']) for r in workspace.json()['items']} == {
        ('Physics', 1, 'theory'), ('Physics lab', 2, 'practical')}
    from app.modules.master_data.enrollment.api import semester_labels
    assert semester_labels(fetched) == course()['semester_labels']
    patch = client.patch(f'{BASE}/{code}', headers=headers, json={'details': 'Changed'})
    assert patch.status_code == 200, patch.text
    assert patch.json()['details'] == 'Changed'


@pytest.mark.parametrize('changes', [
    {'duration_years': 0}, {'semester_labels': ['Only one']},
    {'semester_labels': ['Same'] * 4}, {'duration_semesters': 17},
    {'subject_entries': [{'name': 'Physics', 'semester_number': 5, 'subject_type': 'theory'}]},
    {'subject_entries': [{'name': 'Physics', 'semester_number': 1, 'subject_type': 'other'}]},
])
def test_invalid_new_course_is_atomic(client, headers, app, changes):
    response = client.post(BASE, headers=headers, json={**course(), **changes})
    assert response.status_code == 422, response.text
    assert not app.state.store.snapshot()['records'].get('programs')


def test_legacy_course_request_still_works(client, headers, app):
    with app.state.store.transaction() as data:
        data['records'].setdefault('departments', {})['D'] = {'code': 'D', 'name': 'Science'}
    response = client.post(BASE, headers=headers, json={
        'name': 'Legacy course', 'department_code': 'D', 'qualification': 'BSc',
        'course_level': 'degree', 'duration_semesters': 6, 'branch_code': 'LEGACY'})
    assert response.status_code == 201, response.text
    assert response.json()['name'] == 'Legacy course'


def test_course_setup_action_uses_new_form_and_accepts_dotted_payload(client, headers):
    actions = client.get('/api/v1/master-data/actions', headers=headers).json()['actions']
    form = next(a for a in actions if a['key'] == 'create-course')
    keys = [f['key'] for f in form['fields']]
    assert keys[0] == 'program.course_level'
    assert not {'program.department_code', 'program.name', 'program.category',
                'program.duration_label', 'program.career_opportunities', 'program.qualification'} & set(keys)
    response = client.post('/api/v1/master-data/actions/create-course', headers=headers,
                           json={'values': {f'program.{k}': v for k, v in course().items()}})
    assert response.status_code == 201, response.text
    row = response.json()['program']
    assert row['code'] == 'DEG-APPSCI'
    assert row['duration_label'] == '3 years'
    assert row['semester_labels'] == course()['semester_labels']
    workspace = client.get(f"/api/v1/academics/course-curricula/{row['code']}/workspace", headers=headers)
    assert workspace.status_code == 200, workspace.text
    assert {r['name'] for r in workspace.json()['items']} == {'Physics', 'Physics lab'}


@pytest.mark.parametrize('level,prefix', [('intermediate', 'INT'), ('degree', 'DEG')])
def test_course_code_uses_level_and_normalized_branch(client, headers, level, prefix):
    values = {**course(), 'course_level': level, 'branch_code': ' bpc '}
    created = client.post(BASE, headers=headers, json=values)
    assert created.status_code == 201, created.text
    row = created.json()
    assert row['code'] == f'{prefix}-BPC'
    assert row['branch_code'] == 'BPC'
    duplicate = client.post(BASE, headers=headers, json=values)
    assert duplicate.status_code == 409, duplicate.text
    assert f'{prefix}-BPC' in duplicate.json()['detail']
    edited = client.patch(f"{BASE}/{row['code']}", headers=headers, json={'details': 'Updated'})
    assert edited.status_code == 200, edited.text
    assert edited.json()['code'] == row['code']


def test_explicit_existing_client_course_code_is_preserved(client, headers):
    created = client.post(BASE, headers=headers, json={**course(), 'code': 'BSC-APPLIED'})
    assert created.status_code == 201, created.text
    assert created.json()['code'] == 'BSC-APPLIED'


@pytest.mark.parametrize('path', [BASE, '/api/v1/workspace/resources/programs'])
def test_course_level_and_name_edits_refresh_generated_name(client, headers, path):
    created = client.post(BASE, headers=headers, json={**course(), 'qualification': '10th', 'branch': 'HAC'})
    assert created.status_code == 201, created.text
    row = created.json()
    assert row['name'] == 'Degree · HAC'
    assert row['qualification'] == 'Degree'
    changes = {'course_level': 'intermediate', 'qualification': '10th'}
    payload = {'values': changes} if '/workspace/' in path else changes
    updated = client.patch(f"{path}/{row['code']}", headers=headers, json=payload)
    assert updated.status_code == 200, updated.text
    assert updated.json()['name'] == 'Intermediate · HAC'
    assert updated.json()['qualification'] == 'Intermediate'
    changes = {'branch': 'HEC'}
    payload = {'values': changes} if '/workspace/' in path else changes
    updated = client.patch(f"{path}/{row['code']}", headers=headers, json=payload)
    assert updated.status_code == 200, updated.text
    assert updated.json()['name'] == 'Intermediate · HEC'
    fetched = client.get(f"{BASE}/{row['code']}", headers=headers).json()
    assert fetched['name'] == 'Intermediate · HEC'
    assert fetched['code'] == row['code']


def test_legacy_custom_course_name_survives_qualification_edit(client, headers):
    created = client.post(BASE, headers=headers, json={
        'name': 'Custom catalog title', 'qualification': 'BSc', 'branch': 'Science',
        'branch_code': 'CUSTOM', 'course_level': 'degree', 'duration_semesters': 6})
    assert created.status_code == 201, created.text
    updated = client.patch(f"{BASE}/{created.json()['code']}", headers=headers, json={'qualification': 'BSc Honours'})
    assert updated.status_code == 200, updated.text
    assert updated.json()['name'] == 'Custom catalog title'


def test_resaving_course_repairs_an_already_stale_generated_title(client, headers, app):
    created = client.post(BASE, headers=headers, json={**course(), 'course_level': 'intermediate', 'branch': 'HAC'})
    assert created.status_code == 201, created.text
    code = created.json()['code']
    with app.state.store.transaction() as data:
        data['records']['programs'][code]['name'] = '10th · HAC'
    repaired = client.patch(f'{BASE}/{code}', headers=headers, json={})
    assert repaired.status_code == 200, repaired.text
    assert repaired.json()['name'] == 'Intermediate · HAC'


@pytest.mark.parametrize('level,qualification,prefix', [('intermediate', 'Intermediate', 'INT'), ('degree', 'Degree', 'DEG')])
def test_course_creation_derives_qualification_from_level(client, headers, level, qualification, prefix):
    values = {**course(), 'course_level': level, 'branch': 'HAC', 'branch_code': 'HAC'}
    values.pop('qualification')
    response = client.post('/api/v1/master-data/actions/create-course', headers=headers,
                           json={'values': {f'program.{key}': value for key, value in values.items()}})
    assert response.status_code == 201, response.text
    row = response.json()['program']
    assert row['qualification'] == qualification
    assert row['name'] == f'{qualification} · HAC'
    assert row['code'] == f'{prefix}-HAC'


def test_direct_course_api_accepts_no_qualification(client, headers):
    values = {**course(), 'course_level': 'intermediate'}
    values.pop('qualification')
    response = client.post(BASE, headers=headers, json=values)
    assert response.status_code == 201, response.text
    assert response.json()['qualification'] == 'Intermediate'
