"""Send emails through Azure Communication Services Email (EDUNEXA_EMAIL_* settings)."""

import logging

log = logging.getLogger(__name__)


def email_configured(settings):
    return bool(getattr(settings, "email_connection_string", None) and getattr(settings, "email_sender", None))


def send_email(settings, to, subject, text, html=None):
    """Send one email; True when Azure accepted it. Never raises (callers run it in the background)."""
    allowed = getattr(settings, "email_allowed_recipients", None)
    if allowed is not None and str(to).strip().casefold() not in {str(address).strip().casefold() for address in allowed}:
        log.warning("Email blocked by recipient allowlist")
        return False
    if not email_configured(settings):
        log.warning("Email is not configured (EDUNEXA_EMAIL_CONNECTION_STRING / EDUNEXA_EMAIL_SENDER); not sent")
        return False
    try:
        from azure.communication.email import EmailClient

        client = EmailClient.from_connection_string(settings.email_connection_string.get_secret_value())
        message = {
            "senderAddress": settings.email_sender,
            "recipients": {"to": [{"address": to}]},
            "content": {"subject": subject, "plainText": text, **({"html": html} if html else {})},
        }
        result = client.begin_send(message).result()
        if (result or {}).get("status") != "Succeeded":
            log.error("Email to %s was not accepted: %s", to, (result or {}).get("status"))
            return False
        return True
    except Exception:
        log.exception("Sending email failed")
        return False
