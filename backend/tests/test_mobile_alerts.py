from tests.test_screen_workflows import classroom, mobile_login


def test_devices_are_bound_to_signed_in_identity_and_unregister_is_scoped(client, seeded, headers):
    classroom(seeded)
    parent = mobile_login(client, seeded, "parent", "P1", "parent-mobile")
    token = "mock-device-registration-token-123456"
    route = "/api/v1/mobile/devices/"
    assert client.post(route + "register", json={"token": token, "platform": "android"}).status_code == 401
    assert client.post(route + "register", headers=parent, json={"token": token, "platform": "android"}).status_code == 200
    assert client.post(route + "unregister", headers=headers, json={"token": token}).status_code == 200
    devices = seeded.state.store.snapshot()["records"]["device_tokens"]
    assert len(devices) == 1
    assert client.post(route + "register", headers=parent, json={"token": token, "platform": "android"}).status_code == 200
    assert len(seeded.state.store.snapshot()["records"]["device_tokens"]) == 1
    assert client.post(route + "unregister", headers=parent, json={"token": token}).status_code == 200
    assert not seeded.state.store.snapshot()["records"]["device_tokens"]


def test_admin_inbox_is_personal_and_alerts_can_be_read(client, seeded, headers):
    classroom(seeded)
    parent = mobile_login(client, seeded, "parent", "P1", "parent-mobile")
    parent_code = client.get("/api/v1/auth/me", headers=parent).json()["account"]["code"]
    payload = {"recipient_user_code": parent_code, "title": "College notice", "body": "Meeting tomorrow"}
    assert client.post("/api/v1/mobile/alerts", headers=parent, json=payload).status_code == 403
    response = client.post("/api/v1/mobile/alerts", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    code = response.json()["notification_code"]
    admin = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "Strong-Test-Password-245!", "client": "admin-mobile"}).json()
    admin_headers = {"Authorization": "Bearer " + admin["access_token"]}
    assert not client.get("/api/v1/mobile/workspace/notifications", headers=admin_headers).json()["items"]
    parent_notices = client.get("/api/v1/mobile/workspace/notifications", headers=parent).json()["items"]
    assert parent_notices[0]["title"] == "College notice"
    path = "/api/v1/mobile/workspace/notifications/actions/read_notification"
    assert client.post(path, headers=admin_headers, json={"values": {"notification_code": code}}).status_code == 404
    assert client.post(path, headers=parent, json={"values": {"notification_code": code}}).status_code == 201
    assert seeded.state.store.snapshot()["records"]["notifications"][code]["status"] == "read"
    # Configuration errors must not claim a device notification was delivered.
    assert client.post("/api/v1/mobile/alerts", headers=headers, json={**payload, "push": True}).status_code == 503
    assert len(seeded.state.store.snapshot()["records"]["notifications"]) == 1


def test_push_provider_acceptance_and_failure_are_recorded(client, seeded, headers, monkeypatch):
    classroom(seeded)
    parent = mobile_login(client, seeded, "parent", "P1", "parent-mobile")
    parent_code = client.get("/api/v1/auth/me", headers=parent).json()["account"]["code"]
    client.post("/api/v1/mobile/devices/register", headers=parent,
                json={"token": "mock-device-token-1234567890", "platform": "ios"})
    from pydantic import SecretStr
    seeded.state.settings.push_adapter_url = "https://push.example.test/send"
    seeded.state.settings.push_adapter_token = SecretStr("private-adapter-key")
    calls = []
    def accepted(url, secret, payload):
        calls.append(payload)
        return {"accepted": True}
    monkeypatch.setattr("app.core.push_api.adapter_post", accepted)
    payload = {"recipient_user_code": parent_code, "title": "Event alert", "body": "Sports day", "push": True}
    result = client.post("/api/v1/mobile/alerts", headers=headers, json=payload)
    assert result.status_code == 201
    assert result.json()["push_accepted"]
    assert calls[0]["data"]["notification_code"] == result.json()["notification_code"]
    assert seeded.state.store.snapshot()["records"]["notifications"][result.json()["notification_code"]]["status"] == "sent"
    monkeypatch.setattr("app.core.push_api.adapter_post", lambda *args: {"accepted": False})
    assert client.post("/api/v1/mobile/alerts", headers=headers, json=payload).status_code == 502
    assert any(r["status"] == "failed" for r in seeded.state.store.snapshot()["records"]["notifications"].values())


def test_admin_event_and_announcement_forms_validate_and_persist(client, app, headers):
    with app.state.store.transaction() as data:
        data["records"].setdefault("institutions", {})["I"] = {"code": "I", "name": "College"}
        data["records"].setdefault("campuses", {})["C"] = {"code": "C", "institution_code": "I", "name": "Main"}
    login = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "Strong-Test-Password-245!", "client": "admin-mobile"}).json()
    auth = {"Authorization": "Bearer " + login["access_token"]}
    path = "/api/v1/mobile/workspace/"
    fields = {"campus_code": "C", "title": "Sports day", "event_type": "sports", "starts_at": "2026-11-02T09:00:00", "ends_at": "2026-11-02T12:00:00"}
    result = client.post(path + "calendar/actions/create_event", headers=auth, json={"values": fields})
    assert result.status_code == 201, result.text
    assert client.get(path + "calendar", headers=auth).json()["total"] == 1
    assert client.post(path + "calendar/actions/create_event", headers=auth, json={"values": {**fields, "ends_at": "2026-11-01T09:00:00"}}).status_code == 422
    result = client.post(path + "announcements/actions/publish_announcement", headers=auth,
                         json={"values": {"campus_code": "C", "title": "Sports day announced", "body": "Join us next week."}})
    assert result.status_code == 201, result.text
    assert result.json()["record"]["author_code"] == "ADMIN-EMP"


def test_provider_and_security_actions_do_not_accept_custom_form_bindings(client, headers):
    for action in ["send_alert", "create_event", "publish_announcement", "make_payment", "change_password", "read_notification"]:
        result = client.post("/api/v1/forms", headers=headers, json={
            "name": "Unsupported custom binding", "screen": "mobile." + action,
            "fields": [{"key": "extra", "label": "Extra"}],
        })
        assert result.status_code == 422, result.text


def test_calendar_filters_month_overlaps_and_latest_alerts_are_first(client, app, headers):
    with app.state.store.transaction() as data:
        data["records"]["calendar_events"] = {
            "OLD": {"code": "OLD", "starts_at": "2026-09-01T09:00:00+00:00", "ends_at": "2026-09-01T10:00:00+00:00"},
            "SPAN": {"code": "SPAN", "starts_at": "2026-09-30T09:00:00+00:00", "ends_at": "2026-10-02T10:00:00+00:00"},
            "NEW": {"code": "NEW", "starts_at": "2026-10-26T09:00:00+00:00", "ends_at": "2026-10-26T10:00:00+00:00"},
        }
        data["records"]["notifications"] = {
            "A": {"code": "A", "user_code": "ADMIN", "title": "Older", "sent_at": "2026-10-01T09:00:00+00:00"},
            "Z": {"code": "Z", "user_code": "ADMIN", "title": "Latest", "sent_at": "2026-10-26T09:00:00+00:00"},
        }
    login = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "Strong-Test-Password-245!", "client": "admin-mobile"}).json()
    auth = {"Authorization": "Bearer " + login["access_token"]}
    route = "/api/v1/mobile/workspace/"
    response = client.get(route + "calendar?from_date=2026-10-01&to_date=2026-10-31", headers=auth)
    assert [r["code"] for r in response.json()["items"]] == ["SPAN", "NEW"]
    assert client.get(route + "calendar?from_date=2026-11-01&to_date=2026-10-01", headers=auth).status_code == 422
    assert client.get(route + "notifications", headers=auth).json()["items"][0]["title"] == "Latest"
