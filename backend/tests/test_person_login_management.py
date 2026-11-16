import pytest

def seed_people(app):
    with app.state.store.transaction() as d:
        for table, rows in {
            'students': {'S': {'code': 'S', 'first_name': 'Student'}},
            'parents': {'P': {'code': 'P', 'first_name': 'Guardian'}, 'UNRELATED': {'code': 'UNRELATED', 'first_name': 'Other'}},
            'student_parents': {'SP': {'code': 'SP', 'student_code': 'S', 'parent_code': 'P', 'relationship': 'Mother'}},
        }.items(): d['records'].setdefault(table, {}).update(rows)
        d['roles']['PARENT'] = {'code': 'PARENT', 'name': 'Parent', 'scope': 'self', 'system_admin': False, 'permissions': {}}


def test_linked_logins_are_scoped_and_passwords_private(client, app, headers):
    seed_people(app)
    body = {'login_id': 'guardian.test', 'password': 'Strong-Guardian-123!', 'person_type': 'parent', 'person_code': 'P', 'role_codes': [], 'clients': ['parent-mobile']}
    made = client.post('/api/v1/administration/accounts', headers=headers, json=body)
    assert made.status_code == 201
    response = client.get('/api/v1/administration/people/student/S/logins', headers=headers)
    assert response.status_code == 200
    assert {(p['person_type'], p['person_code']) for p in response.json()['people']} == {('student', 'S'), ('parent', 'P')}
    assert 'password_hash' not in response.text and body['password'] not in response.text
    code = made.json()['code']
    changed = client.patch('/api/v1/administration/accounts/' + code, headers=headers, json={'login_id': 'guardian.changed', 'active': False})
    assert changed.status_code == 200 and changed.json()['login_id'] == 'guardian.changed'
    login = client.post('/api/v1/auth/login', json={'login_id': 'guardian.changed', 'password': body['password'], 'client': 'parent-mobile'})
    assert login.status_code == 401
    assert client.patch('/api/v1/administration/accounts/' + code, headers=headers, json={'login_id': 'ADMIN'}).status_code == 409


def test_person_logins_require_account_management_permission(client, app, headers):
    seed_people(app)
    with app.state.store.transaction() as d:
        d['roles']['ROOT']['system_admin'] = False
        d['roles']['ROOT']['permissions'] = {'students': ['view']}
    assert client.get('/api/v1/administration/people/student/S/logins', headers=headers).status_code == 403


def test_teacher_app_and_web_share_login_and_reset_ends_sessions(client, app, headers):
    seed_people(app)
    with app.state.store.transaction() as d:
        d['records']['employees']['TEACHER'] = {'code': 'TEACHER', 'first_name': 'Faculty', 'employee_type': 'teacher'}
        d['roles']['FACULTY'] = {'code': 'FACULTY', 'name': 'Faculty', 'scope': 'teaching', 'system_admin': False, 'permissions': {}}
    body = {'login_id': 'faculty.test', 'password': 'Strong-Faculty-123!', 'person_type': 'employee', 'person_code': 'TEACHER', 'role_codes': ['FACULTY'], 'clients': ['teacher-mobile', 'admin-web'], 'email': 'faculty.test@pragathiews.org'}
    made = client.post('/api/v1/administration/accounts', headers=headers, json=body)
    assert made.status_code == 201
    logins = client.get('/api/v1/administration/people/employee/TEACHER/logins', headers=headers).json()
    assert len(logins['people']) == 1
    assert set(logins['people'][0]['account']['clients']) == {'teacher-mobile', 'admin-web'}
    token = client.post('/api/v1/auth/login', json={'login_id': 'faculty.test', 'password': body['password'], 'client': 'teacher-mobile'}).json()['access_token']
    changed = client.post('/api/v1/administration/accounts/' + made.json()['code'] + '/reset-password', headers=headers, json={'new_password': 'Changed-Faculty-123!'})
    assert changed.status_code == 204
    assert client.get('/api/v1/auth/me', headers={'Authorization': 'Bearer ' + token}).status_code == 401
    assert client.post('/api/v1/auth/login', json={'login_id': 'faculty.test', 'password': body['password'], 'client': 'teacher-mobile'}).status_code == 401
    assert client.post('/api/v1/auth/login', json={'login_id': 'faculty.test', 'password': 'Changed-Faculty-123!', 'client': 'admin-web'}).status_code == 200


def test_personal_login_uses_default_role_and_cannot_access_web(client, app, headers):
    seed_people(app)
    made = client.post('/api/v1/administration/accounts', headers=headers, json={'login_id': 'parent.mobile', 'password': 'Strong-Parent-123!', 'person_type': 'parent', 'person_code': 'P', 'role_codes': ['ROOT'], 'clients': ['admin-web', 'parent-mobile']})
    assert made.status_code == 201, made.text
    assert made.json()['clients'] == ['parent-mobile'] and made.json()['role_codes'] == ['PARENT']
    # Legacy accounts may still have dashboard in their stored clients: deny sign-in and refresh regardless.
    with app.state.store.transaction() as d: d['accounts'][made.json()['code']]['clients'].append('admin-web')
    assert client.post('/api/v1/auth/login', json={'login_id': 'parent.mobile', 'password': 'Strong-Parent-123!', 'client': 'admin-web'}).status_code == 401
    assert client.post('/api/v1/auth/login', json={'login_id': 'parent.mobile', 'password': 'Strong-Parent-123!', 'client': 'parent-mobile'}).status_code == 200
    changed = client.patch('/api/v1/administration/accounts/' + made.json()['code'], headers=headers, json={'role_codes': ['ROOT'], 'clients': ['admin-web']})
    assert changed.status_code == 200 and changed.json()['clients'] == ['parent-mobile'] and changed.json()['role_codes'] == ['PARENT']


@pytest.mark.parametrize("kind, person, mobile", [("student", "S", "student-mobile"), ("parent", "P", "parent-mobile")])
def test_legacy_personal_web_sessions_are_denied(client, app, headers, kind, person, mobile):
    from app.core.security import issue
    seed_people(app)
    with app.state.store.transaction() as data:
        data['roles']['STUDENT'] = {"code": "STUDENT", "name": "Student", "scope": "self", "system_admin": False, "permissions": {}}
    made = client.post('/api/v1/administration/accounts', headers=headers, json={'login_id': kind + '.legacy', 'password': 'Strong-Personal-123!', 'person_type': kind, 'person_code': person, 'role_codes': [], 'clients': [mobile, 'admin-web']})
    assert made.status_code == 201, made.text
    assert made.json()['clients'] == [mobile] and made.json()['role_codes'] == [kind.upper()]
    with app.state.store.transaction() as data:
        account = data['accounts'][made.json()['code']]
        account['clients'].append('admin-web')
        legacy = issue(data, account, 'admin-web', app.state.settings)
    assert client.get('/api/v1/auth/me', headers={'Authorization': 'Bearer ' + legacy['access_token']}).status_code == 401
    assert client.post('/api/v1/auth/refresh', json={'refresh_token': legacy['refresh_token'], 'client': 'admin-web'}).status_code == 401


def test_staff_logins_need_a_unique_email_mobile_optional_and_families_need_neither(client, app, headers):
    seed_people(app)
    with app.state.store.transaction() as d:
        for code in ('T1', 'T2'):
            d['records']['employees'][code] = {'code': code, 'first_name': code, 'employee_type': 'teacher'}
        d['roles']['FACULTY'] = {'code': 'FACULTY', 'name': 'Faculty', 'scope': 'teaching', 'system_admin': False, 'permissions': {}}
    staff = {'password': 'Strong-Faculty-123!', 'person_type': 'employee', 'role_codes': ['FACULTY'], 'clients': ['teacher-mobile']}
    post = lambda body: client.post('/api/v1/administration/accounts', headers=headers, json=body)
    missing = post({**staff, 'login_id': 't.one', 'person_code': 'T1'})
    assert missing.status_code == 422 and 'email address is required' in missing.text
    assert post({**staff, 'login_id': 't.one', 'person_code': 'T1', 'email': 'not-an-email'}).status_code == 422
    # Mobile is optional, but when given it must be valid.
    assert post({**staff, 'login_id': 't.one', 'person_code': 'T1', 'email': 't1@pragathiews.org',
                 'country_code': '+91', 'mobile_number': '5876543210'}).status_code == 422
    made = post({**staff, 'login_id': 't.one', 'person_code': 'T1', 'email': ' T1@PragathiEWS.org '})
    assert made.status_code == 201, made.text
    assert made.json()['email'] == 't1@pragathiews.org' and 'mobile_number' not in made.json()
    taken = post({**staff, 'login_id': 't.two', 'person_code': 'T2', 'email': 't1@pragathiews.org'})
    assert taken.status_code == 409 and 'email address is already used' in taken.text
    with_mobile = post({**staff, 'login_id': 't.two', 'person_code': 'T2', 'email': 't2@pragathiews.org',
                        'country_code': '+91', 'mobile_number': '8367048538'})
    assert with_mobile.status_code == 201 and with_mobile.json()['mobile_number'] == '8367048538'
    # Parents and students still sign in without an email.
    family = {'login_id': 'guardian.one', 'password': 'Strong-Parent-123!', 'person_type': 'parent', 'person_code': 'P',
              'role_codes': [], 'clients': ['parent-mobile']}
    assert post(family).status_code == 201
    # Switching a staff login off never asks for anything.
    code = made.json()['code']
    assert client.patch('/api/v1/administration/accounts/' + code, headers=headers, json={'active': False}).status_code == 200
