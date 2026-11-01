import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from seed_linked_academics import populate
from app.core.curriculum_workspace import insert, starter, student_subjects
from tests.test_screen_workflows import mobile_login


def seed(app):
    with app.state.store.transaction() as d:
        def put(t, c, **v): d['records'].setdefault(t, {})[c] = {'code': c, **v}
        put('institutions', 'I', name='Pragathi College')
        put('campuses', 'C', institution_code='I', name='Main')
        put('departments', 'D', campus_code='C', name='Academics')
        for i, (name, duration) in enumerate([('Intermediate BPC', 4), ('Intermediate MPC', 4), ('BCA', 6), ('B.Com General', 6)]):
            p = {'code': f'P{i}', 'name': name, 'department_code': 'D', 'duration_semesters': duration,
                 'course_level': 'intermediate' if i < 2 else 'degree'}
            d['records'].setdefault('programs', {})[p['code']] = p
            insert(d, p, starter(p), True)
        populate(d, 'test@123')
        put('employees', 'LABE1', first_name='Kiran', last_name='Rao', status='active', employee_type='staff',
            campus_code='C', designation='Lab in-charge')
        # A lab subject that has a weekly timetable slot.
        offerings = d['records']['subject_offerings']
        subjects = d['records']['subjects']
        slot = next(s for s in d['records'].get('timetable_slots', {}).values()
                    if 'lab' in subjects[offerings[s['offering_code']]['subject_code']].get('name', '').lower()
                    or 'practical' in subjects[offerings[s['offering_code']]['subject_code']].get('name', '').lower())
        offering = offerings[slot['offering_code']]
        return offering, slot


def test_register_lab_assign_incharge_and_show_sessions(app, client, headers):
    offering, slot = seed(app)
    options = client.get('/api/v1/academics/labs', headers=headers).json()
    assert any(e['code'] == 'LABE1' for e in options['incharges'])
    assert any(s['code'] == offering['subject_code'] for s in options['subjects'])

    body = {'name': 'Biology Lab 1', 'floor': '1st', 'room_number': '104', 'lab_type': 'Biology',
            'incharge_employee_code': 'LABE1', 'subject_codes': [offering['subject_code']]}
    created = client.post('/api/v1/academics/labs', headers=headers, json=body)
    assert created.status_code == 201, created.text
    lab = created.json()
    assert lab['incharge_name'] == 'Kiran Rao' and lab['subjects'][0]['code'] == offering['subject_code']
    # Same name or same room again is refused.
    assert client.post('/api/v1/academics/labs', headers=headers, json=body).status_code == 409
    assert client.post('/api/v1/academics/labs', headers=headers,
                       json={**body, 'name': 'Other lab', 'incharge_employee_code': None}).status_code == 409
    moved = client.put(f"/api/v1/academics/labs/{lab['code']}", headers=headers,
                       json={**body, 'room_number': '105', 'revision': 1})
    assert moved.status_code == 200 and moved.json()['room_number'] == '105'
    assert app.state.store.snapshot()['roles']['LAB_INCHARGE']['name'] == 'Lab In-charge'

    # Students see where the lab is held and who runs it.
    data = app.state.store.snapshot()
    student = next(e['student_code'] for e in data['records']['student_enrollments'].values()
                   if e['section_code'] == offering['section_code'] and e.get('status') == 'active')
    subjects = student_subjects(data, {student})
    held = next((s for s in subjects if s['subject_code'] == offering['subject_code']), None)
    if held:
        assert held['lab']['name'] == 'Biology Lab 1' and held['lab']['incharge_name'] == 'Kiran Rao'

    # The lab in-charge signs in to the staff app and sees lab screens, not teaching ones.
    staff = mobile_login(client, app, 'labstaff', 'LABE1', 'teacher-mobile')
    screens = [s['key'] for s in client.get('/api/v1/mobile/workspace/screens', headers=staff).json()['screens']]
    assert screens[:2] == ['profile', 'labs'] and 'payslips' in screens and 'tax-documents' in screens
    assert 'classes' not in screens and 'attendance' not in screens
    week = client.get('/api/v1/mobile/workspace/timetable', headers=staff).json()['items']
    assert week and all(w['lab_name'] == 'Biology Lab 1' for w in week)
    # The session day: batch, time period, students and attendance.
    today = date.today()
    day = today - timedelta(days=(today.isoweekday() - int(slot['weekday'])) % 7)
    sessions = client.get(f'/api/v1/mobile/workspace/labs?from_date={day.isoformat()}', headers=staff).json()
    first = sessions['items'][0]
    assert first['academic_year_name'] and first['start_time'] and first['students']
    assert set(first['counts']) >= {'present', 'absent', 'total', 'unmarked'}
    assert sessions['summary']['sessions'] == len(sessions['items'])
    assert client.get('/api/v1/mobile/workspace/payslips', headers=staff).status_code == 200


def test_teachers_keep_teaching_screens_and_parents_cannot_register_labs(app, client, headers):
    seed(app)
    parent = mobile_login(client, app, 'parent', next(iter(app.state.store.snapshot()['records']['parents'])), 'parent-mobile')
    assert client.post('/api/v1/academics/labs', headers=parent,
                       json={'name': 'X lab', 'floor': 'G', 'room_number': '1'}).status_code == 403
    teacher_employee = next(iter(app.state.store.snapshot()['records']['teachers'].values()))['employee_code']
    teacher = mobile_login(client, app, 'teacher', teacher_employee, 'teacher-mobile')
    screens = [s['key'] for s in client.get('/api/v1/mobile/workspace/screens', headers=teacher).json()['screens']]
    assert 'classes' in screens and 'labs' not in screens
