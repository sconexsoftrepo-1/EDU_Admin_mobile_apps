import secrets
from types import SimpleNamespace

import pytest

from app.core import sql_queries
from app.core.settings import Settings
from app.core.sql_store import Column, Session, from_db, to_db
from app.core.sqlserver import Cursor, SqlServerSettings, identifier
from tools.transfer_to_sqlserver import prepare


def test_sqlserver_runtime_and_identifier_validation(monkeypatch):
    settings = SqlServerSettings(_env_file=None, host='s', name='d', user='u', password='p')
    assert settings.encryption == 'require'
    with pytest.raises(ValueError):
        SqlServerSettings(_env_file=None, host='s', name='d', user='u', password='p', db_schema='dbo;DROP DATABASE x')
    with pytest.raises(ValueError):
        identifier('table; DROP TABLE users')
    monkeypatch.setenv('VERCEL', '1')
    assert Settings(_env_file=None, jwt_secret=secrets.token_urlsafe(64), storage_backend='sqlserver').storage_backend == 'sqlserver'


class FakeCursor:
    def __init__(self):
        self.calls = []
        self.pending_error = None

    def execute(self, statement, params):
        self.calls.append((statement, params))

    def nextset(self):
        if self.pending_error:
            raise self.pending_error
        return False


def test_sqlserver_qualifies_tables_and_keeps_parameters_separate():
    raw = FakeCursor()
    cursor = Cursor(raw, 'edunexa_test')
    value = "x'; DROP TABLE users; --"
    cursor.execute('SELECT t.code FROM programs t LEFT JOIN record_extras x ON x.record_code=t.code WHERE t.code=%s', (value,))
    statement, params = raw.calls[0]
    assert 'FROM [edunexa_test].[programs]' in statement
    assert 'JOIN [edunexa_test].[record_extras]' in statement
    assert params == (value,)
    cursor.execute('SELECT t.name FROM sys.tables t', ())
    assert raw.calls[1][0] == 'SELECT t.name FROM sys.tables t'


def test_later_batch_errors_are_not_silently_committed():
    raw = FakeCursor()
    raw.pending_error = RuntimeError('later statement failed')
    with pytest.raises(RuntimeError, match='later statement failed'):
        Cursor(raw, 'dbo').execute('INSERT INTO programs (code) VALUES (%s); INSERT INTO programs (code) VALUES (%s)', ('one', 'two'))


def test_sqlserver_uses_record_crud_and_decodes_json_lists():
    session = Session(None, SimpleNamespace(dialect='sqlserver', schema='dbo', tables={}), writable=True)
    assert not sql_queries.is_sql(session)
    assert sql_queries.fetch_all(session, 'programs', 'INVALID POSTGRES SQL') == []
    column = Column('allowed_clients', 'jsonb', False, False)
    assert from_db(column, to_db(column, ['admin-web'])) == ['admin-web']


def test_migration_merges_login_and_remaps_its_relationships():
    source = {'records': {
        'users': [{'code': 'old', 'login_id': 'Pragathi', 'password_hash': 'source-hash'}],
        'role_permissions': [{'code': 'old-link', 'role_code': 'admin', 'permission_code': 'programs:view'}],
        'user_roles': [{'code': 'ur', 'user_code': 'old', 'role_code': 'admin'}],
        'record_extras': [{'table_name': 'users', 'record_code': 'old', 'data': {'actor': 'old'}}],
    }}
    target = {'records': {
        'users': [{'code': 'current', 'login_id': 'Pragathi', 'password_hash': 'target-hash'}],
        'role_permissions': [{'code': 'current-link', 'role_code': 'admin', 'permission_code': 'programs:view'}],
    }}
    with pytest.raises(ValueError, match='login conflict'):
        prepare(source, target, None)
    records, aliases, allowed = prepare(source, target, 'postgres')
    assert records['users'][0]['code'] == 'current'
    assert records['users'][0]['password_hash'] == 'source-hash'
    assert records['user_roles'][0]['user_code'] == 'current'
    assert records['record_extras'][0]['record_code'] == 'current'
    assert aliases['old-link'] == 'current-link'
    assert allowed == {'current'}
    assert source['records']['users'][0]['code'] == 'old'


def test_staff_schema_check_requires_both_validated_constraints():
    import importlib.util
    from pathlib import Path
    path = Path(__file__).parents[1] / 'tools/setup_staff_schema.py'
    spec = importlib.util.spec_from_file_location('staff_schema', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    class Checks:
        def __init__(self, rows):
            self.rows = rows
        def execute(self, sql, params):
            assert params == ('dbo',)
        def fetchall(self):
            return self.rows

    compatible = [
        ('employees_employee_type_check', "employee_type IN ('teacher','staff','labour')", False, False),
        ('employees_employment_type_check', "employment_type IN ('permanent','contract','part_time','daily_wage')", False, False),
    ]
    assert module.compatible(Checks(compatible), 'dbo')
    assert not module.compatible(Checks(compatible[:1]), 'dbo')
    assert not module.compatible(Checks([(compatible[0][0], "employee_type IN ('teacher','staff')", False, False), compatible[1]]), 'dbo')
    assert not module.compatible(Checks([(*compatible[0][:2], False, True), compatible[1]]), 'dbo')
