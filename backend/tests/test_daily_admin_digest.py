from datetime import datetime
from types import SimpleNamespace

import pytest
from app.core import daily_admin_digest as digest
from app.core.storage import Store


@pytest.fixture
def delivery(tmp_path, monkeypatch):
    store = Store(tmp_path)
    with store.transaction() as data:
        data['roles'] = {'ADMIN': {'system_admin': True}, 'CLERK': {}}
        data['accounts'] = {
            'a': {'active': True, 'email': 'one@example.org', 'role_codes': ['ADMIN']},
            'b': {'active': True, 'email': 'two@example.org', 'role_codes': ['ADMIN']},
            'duplicate': {'active': True, 'email': ' ONE@example.org ', 'role_codes': ['ADMIN']},
            'inactive': {'active': False, 'email': 'inactive@example.org', 'role_codes': ['ADMIN']},
            'clerk': {'active': True, 'email': 'clerk@example.org', 'role_codes': ['CLERK']},
        }
    monkeypatch.setattr(digest, 'build', lambda data, day: {'day': day})
    monkeypatch.setattr(digest, 'render_email', lambda report, settings: ('subject', 'text', 'html', []))
    return store, SimpleNamespace(email_connection_string='configured', email_sender='sender@example.org')


def test_failed_recipient_retries_without_resending_success(delivery, monkeypatch):
    store, settings = delivery
    calls = []
    def send(settings, email, *args, **kwargs):
        calls.append(email)
        return email == 'one@example.org' or calls.count(email) > 1
    monkeypatch.setattr(digest, 'send_email', send)
    assert digest.deliver(store, settings, '2026-11-19') is False
    marker = store.snapshot()['documents']['daily_admin_digest']
    assert 'sent_for' not in marker
    assert marker['2026-11-19']['accepted_count'] == 1
    assert digest.deliver(store, settings, '2026-11-19') is True
    assert calls == ['one@example.org', 'two@example.org', 'two@example.org']
    assert digest.deliver(store, settings, '2026-11-19') is False
    assert len(calls) == 3
    assert store.snapshot()['documents']['daily_admin_digest']['2026-11-19']['status'] == 'accepted'


def test_unconfigured_or_no_admins_never_marks_sent(delivery, monkeypatch):
    store, settings = delivery
    monkeypatch.setattr(digest, 'send_email', lambda *a, **k: pytest.fail('must not send'))
    settings.email_sender = None
    assert digest.deliver(store, settings, '2026-11-19') is False
    settings.email_sender = 'sender@example.org'
    with store.transaction() as data:
        data['accounts'] = {}
    assert digest.deliver(store, settings, '2026-11-19') is False
    assert 'sent_for' not in store.snapshot()['documents']['daily_admin_digest']


def test_concurrent_claim_and_expired_claim(delivery, monkeypatch):
    store, settings = delivery
    now = [1000]
    monkeypatch.setattr(digest.clock, 'time', lambda: now[0])
    calls = []
    def send(settings, email, *args, **kwargs):
        calls.append(email)
        if email == 'one@example.org':
            digest.deliver(store, settings, '2026-11-19')
        return True
    monkeypatch.setattr(digest, 'send_email', send)
    assert digest.deliver(store, settings, '2026-11-19')
    assert calls == ['one@example.org', 'two@example.org']
    with store.transaction() as data:
        data['documents']['daily_admin_digest'] = {'2026-11-18': {'recipients': {
            digest.hashlib.sha256(b'one@example.org').hexdigest(): {'status': 'sending', 'lease_until': 1001}
        }}}
    calls.clear()
    assert not digest.deliver(store, settings, '2026-11-18')
    assert calls == ['two@example.org']
    now[0] = 1002
    # Do not recursively deliver a different day in the lease-expiry check.
    monkeypatch.setattr(digest, 'send_email', lambda settings, email, *a, **k: calls.append(email) or True)
    assert digest.deliver(store, settings, '2026-11-18')
    assert calls == ['two@example.org', 'one@example.org']


@pytest.mark.parametrize('stamp,day,seconds', [
    ('2026-11-20T00:02:00+05:30', '2026-11-18', 180),
    ('2026-11-20T00:05:00+05:30', '2026-11-19', 86400),
    ('2026-11-20T08:00:00+05:30', '2026-11-19', 57900),
    ('2026-11-19T18:35:00+00:00', '2026-11-19', 86400),
])
def test_india_schedule_and_restart_catchup(stamp, day, seconds):
    now = datetime.fromisoformat(stamp)
    assert digest.latest_due_day(now) == day
    assert digest.seconds_until_next_run(now) == seconds


def test_pending_previous_report_survives_next_deadline(delivery, monkeypatch):
    store, settings = delivery
    with store.transaction() as data:
        data['documents'] = {'daily_admin_digest': {'2026-11-18': {'status': 'pending', 'recipients': {}}}}
    calls = []
    monkeypatch.setattr(digest, 'deliver', lambda store, settings, day: calls.append(day))
    digest.deliver_due(store, settings, datetime.fromisoformat('2026-11-20T08:00:00+05:30'))
    assert calls == ['2026-11-18', '2026-11-19']


def test_real_report_renders_on_empty_campus(tmp_path, monkeypatch):
    store = Store(tmp_path)
    with store.transaction() as data:
        data['roles'] = {'ADMIN': {'system_admin': True}}
        data['accounts'] = {'a': {'active': True, 'email': 'admin@example.org', 'role_codes': ['ADMIN']}}
    settings = SimpleNamespace(email_connection_string='configured', email_sender='sender@example.org')
    captured = []
    monkeypatch.setattr(digest, 'send_email', lambda settings, email, subject, text, html, **kwargs: captured.append((subject, text, html)) or True)
    assert digest.deliver(store, settings, '2026-11-19')
    assert '19 November 2026' in captured[0][0]
    assert 'Payments Received' in captured[0][2]
    assert '₹0.00' in captured[0][1]


def test_unexpected_send_error_does_not_block_other_admins(delivery, monkeypatch):
    store, settings = delivery
    def send(settings, email, *args, **kwargs):
        if email == 'one@example.org':
            raise RuntimeError('temporary transport failure')
        return True
    monkeypatch.setattr(digest, 'send_email', send)
    assert not digest.deliver(store, settings, '2026-11-19')
    run = store.snapshot()['documents']['daily_admin_digest']['2026-11-19']
    assert run['status'] == 'pending' and run['accepted_count'] == 1
    assert sorted(r['status'] for r in run['recipients'].values()) == ['accepted', 'failed']


def test_legacy_completed_marker_is_not_resent(delivery, monkeypatch):
    store, settings = delivery
    with store.transaction() as data:
        data['documents'] = {'daily_admin_digest': {'sent_for': '2026-11-19'}}
    monkeypatch.setattr(digest, 'send_email', lambda *a, **k: pytest.fail('legacy completed report must not resend'))
    assert not digest.deliver(store, settings, '2026-11-19')


def test_delivery_markers_meet_sql_server_json_constraint(delivery, monkeypatch):
    """SQL Server ISJSON(data) accepts objects/arrays, not JSON scalar strings."""
    from contextlib import contextmanager
    store, settings = delivery
    transaction = store.transaction
    @contextmanager
    def sql_compatible_transaction():
        with transaction() as data:
            yield data
            for row in data.get('documents', {}).get('daily_admin_digest', {}).values():
                assert isinstance(row, (dict, list)), 'record_extras JSON CHECK rejects scalar document rows'
    monkeypatch.setattr(store, 'transaction', sql_compatible_transaction)
    monkeypatch.setattr(digest, 'send_email', lambda *a, **k: True)
    assert digest.deliver(store, settings, '2026-11-19')
    assert digest.deliver(store, settings, '2026-11-19') is False
    assert store.snapshot()['documents']['daily_admin_digest']['2026-11-19']['accepted_count'] == 2
