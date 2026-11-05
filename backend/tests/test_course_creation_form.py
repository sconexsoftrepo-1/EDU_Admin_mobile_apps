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
    assert row['name'] == 'BSc · Applied Science'
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
                'program.duration_label', 'program.career_opportunities'} & set(keys)
    response = client.post('/api/v1/master-data/actions/create-course', headers=headers,
                           json={'values': {f'program.{k}': v for k, v in course().items()}})
    assert response.status_code == 201, response.text
    row = response.json()['program']
    assert row['duration_label'] == '3 years'
    assert row['semester_labels'] == course()['semester_labels']
    workspace = client.get(f"/api/v1/academics/course-curricula/{row['code']}/workspace", headers=headers)
    assert workspace.status_code == 200, workspace.text
    assert {r['name'] for r in workspace.json()['items']} == {'Physics', 'Physics lab'}
