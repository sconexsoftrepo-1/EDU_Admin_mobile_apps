import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from app.core.storage import Store


def test_store_serializes_concurrent_updates_and_keeps_unicode(tmp_path):
    def increment(_):
        with Store(tmp_path).transaction() as data:
            data['counter'] = data.get('counter', 0) + 1
            data['college'] = 'ప్రగతి — Pragathi'
    with ThreadPoolExecutor(max_workers=4) as workers:
        list(workers.map(increment, range(20)))
    result = Store(tmp_path).snapshot()
    assert result['counter'] == 20
    assert result['college'] == 'ప్రగతి — Pragathi'


def test_store_rolls_back_and_releases_lock_on_failure(tmp_path):
    store = Store(tmp_path)
    with store.transaction() as data:
        data['counter'] = 1
    with pytest.raises(RuntimeError):
        with store.transaction() as data:
            data['counter'] = 2
            raise RuntimeError('abort')
    with store.transaction() as data:
        assert data['counter'] == 1
        data['counter'] = 3
    assert store.snapshot()['counter'] == 3


def test_sqlserver_app_import_does_not_require_fcntl(tmp_path):
    code = '''
import builtins
original = builtins.__import__
def without_fcntl(name, *args, **kwargs):
    if name == 'fcntl':
        raise ModuleNotFoundError("No module named 'fcntl'", name='fcntl')
    return original(name, *args, **kwargs)
builtins.__import__ = without_fcntl
from app.asgi import app
assert app.state.settings.storage_backend == 'sqlserver'
assert type(app.state.store).__name__ == 'SqlServerStore'
'''
    env = {**os.environ,
        'EDUNEXA_JWT_SECRET': 'windows-import-check-' + 'x' * 64,
        'EDUNEXA_STORAGE_BACKEND': 'sqlserver',
        'EDUNEXA_DATA_DIR': str(tmp_path),
        'EDUNEXA_MSSQL_HOST': 'example.invalid',
        'EDUNEXA_MSSQL_NAME': 'test',
        'EDUNEXA_MSSQL_USER': 'test',
        'EDUNEXA_MSSQL_PASSWORD': 'test-only-no-connection',
        'EDUNEXA_FILE_STORAGE': 'local',
    }
    env.pop('VERCEL', None)
    result = subprocess.run([sys.executable, '-c', code], env=env,
        cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr
