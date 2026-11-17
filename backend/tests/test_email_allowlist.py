from types import SimpleNamespace

from pydantic import SecretStr

from app.core.email_delivery import send_email


def settings(allowed):
    return SimpleNamespace(email_allowed_recipients=allowed,
                           email_connection_string=SecretStr("test-only"), email_sender="stage@example.org")


def test_stage_blocks_unlisted_recipients_before_provider_call(monkeypatch):
    def unexpected(*args, **kwargs):
        raise AssertionError("The provider must not be contacted")

    monkeypatch.setattr("azure.communication.email.EmailClient.from_connection_string", unexpected)
    assert send_email(settings(["tester@example.org"]), "real-parent@example.org", "test", "body") is False
    assert send_email(settings([]), "tester@example.org", "test", "body") is False


def test_allowed_recipient_and_existing_unrestricted_behavior(monkeypatch):
    messages = []
    client = SimpleNamespace(begin_send=lambda message: (
        messages.append(message) or SimpleNamespace(result=lambda: {"status": "Succeeded"})))
    monkeypatch.setattr("azure.communication.email.EmailClient.from_connection_string", lambda value: client)
    assert send_email(settings(["Tester@Example.org"]), "tester@example.org", "test", "body") is True
    assert send_email(settings(None), "ordinary@example.org", "test", "body") is True
    assert len(messages) == 2
