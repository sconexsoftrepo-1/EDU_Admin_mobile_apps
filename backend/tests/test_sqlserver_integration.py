"""Opt-in SQL Server integration test, isolated from live dbo records.

Run EDUNEXA_TEST_SQLSERVER=1 .venv/bin/pytest -q tests/test_sqlserver_integration.py.
The test creates its own schema, uses generated credentials, and removes that schema.
"""
import os
import secrets
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.security import hasher
from app.core.settings import Settings
from app.core.sqlserver import SqlServerSettings, SqlServerStore, connect, identifier
from app.main import create_app

pytestmark = pytest.mark.skipif(os.environ.get('EDUNEXA_TEST_SQLSERVER') != '1', reason='SQL Server integration is opt-in')


def test_sqlserver_login_courses_refresh_and_logout(tmp_path):
    schema = 'edunexa_verify_' + uuid4().hex[:12]
    settings = SqlServerSettings()
    admin = connect(settings)
    admin.autocommit = True
    raw = admin.raw.cursor()
    tables = ['institutions','campuses','departments','programs','users','roles','permissions',
        'user_roles','role_permissions','refresh_tokens','login_attempts','audit_logs',
        'record_extras','form_definitions','form_submissions','admission_sources']
    store = None
    try:
        raw.execute(f'CREATE SCHEMA {identifier(schema)}')
        for table in tables:
            raw.execute(f'SELECT TOP (0) * INTO {identifier(schema)}.{identifier(table)} FROM dbo.{identifier(table)}')
            raw.execute('''SELECT c.name,dc.definition FROM sys.default_constraints dc
                JOIN sys.tables t ON t.object_id=dc.parent_object_id
                JOIN sys.schemas s ON s.schema_id=t.schema_id
                JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=dc.parent_column_id
                WHERE s.name=%s AND t.name=%s''', ('dbo',table))
            defaults=raw.fetchall()
            for column,default in defaults:
                raw.execute(f'ALTER TABLE {identifier(schema)}.{identifier(table)} ADD DEFAULT {default} FOR {identifier(column)}')
            if table == 'record_extras':
                raw.execute(f'CREATE UNIQUE INDEX ux_extras ON {identifier(schema)}.[record_extras] (table_name,record_code)')
            else:
                raw.execute(f'CREATE UNIQUE INDEX ux_code ON {identifier(schema)}.{identifier(table)} (code)')
        for child,column,parent in [('campuses','institution_code','institutions'),('departments','campus_code','campuses'),
            ('programs','department_code','departments'),('user_roles','user_code','users'),
            ('user_roles','role_code','roles'),('refresh_tokens','user_code','users')]:
            raw.execute(f'ALTER TABLE {identifier(schema)}.{identifier(child)} ADD FOREIGN KEY ({identifier(column)}) REFERENCES {identifier(schema)}.{identifier(parent)} (code)')
        store=SqlServerStore(settings.model_copy(update={'db_schema':schema}))
        password=secrets.token_urlsafe(24)
        with store.transaction() as data:
            data['roles']['VERIFY-ROLE']={'code':'VERIFY-ROLE','name':'Verification admin','system_admin':True,'permissions':{}}
            data['accounts']['VERIFY-USER']={'code':'VERIFY-USER','login_id':'verification-user','password_hash':hasher.hash(password),
                'active':True,'person_type':'system','person_code':'verification','role_codes':['VERIFY-ROLE'],'clients':['admin-web']}
            data['records']['institutions']['I']={'code':'I','name':'Verification college'}
            data['records']['campuses']['C']={'code':'C','institution_code':'I','name':'Verification campus'}
            data['records']['departments']['D']={'code':'D','campus_code':'C','name':'Verification department'}
        app=create_app(Settings(_env_file=None,jwt_secret=secrets.token_urlsafe(64),storage_backend='local-json',data_dir=tmp_path))
        app.state.store=store
        with TestClient(app) as client:
            login=client.post('/api/v1/auth/login',json={'login_id':'verification-user','password':password,'client':'admin-web'})
            assert login.status_code==200, login.status_code
            session=login.json()
            headers={'Authorization':'Bearer '+session['access_token']}
            assert client.get('/api/v1/auth/me',headers=headers).status_code==200
            created=client.post('/api/v1/academics/programs',headers=headers,json={
                'department_code':'D','name':'Verification course','qualification':'Degree',
                'duration_semesters':6,'intake_capacity':30,'course_level':'degree'})
            assert created.status_code==201, created.status_code
            options=client.get('/api/v1/public/options')
            assert options.status_code==200
            assert [p['name'] for p in options.json()['programs']]==['Verification course']
            courses=client.get('/api/v1/academics/programs',headers=headers)
            assert courses.status_code==200,courses.status_code
            assert courses.json()['total']==1
            refresh=client.post('/api/v1/auth/refresh',json={'refresh_token':session['refresh_token'],'client':'admin-web'})
            assert refresh.status_code==200,refresh.status_code
            assert client.get('/api/v1/auth/me',headers=headers).status_code==401
            new_headers={'Authorization':'Bearer '+refresh.json()['access_token']}
            assert client.get('/api/v1/auth/me',headers=new_headers).status_code==200
            assert client.post('/api/v1/auth/logout',headers=new_headers).status_code==204
            assert client.get('/api/v1/auth/me',headers=new_headers).status_code==401
    finally:
        if store:
            store.close()
        # Only the generated verification schema is touched during cleanup.
        raw.execute('''SELECT fk.name,t.name FROM sys.foreign_keys fk
            JOIN sys.tables t ON t.object_id=fk.parent_object_id
            JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=%s''',(schema,))
        for name,table in raw.fetchall():
            raw.execute(f'ALTER TABLE {identifier(schema)}.{identifier(table)} DROP CONSTRAINT {identifier(name)}')
        for table in reversed(tables):
            raw.execute(f'DROP TABLE IF EXISTS {identifier(schema)}.{identifier(table)}')
        raw.execute(f'DROP SCHEMA IF EXISTS {identifier(schema)}')
        admin.close()
