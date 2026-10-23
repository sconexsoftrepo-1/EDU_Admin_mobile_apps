import time

import jwt


def login(
    client,
    client_name="admin-web",
    login_id="admin",
    password="Strong-Test-Password-245!",
):
    return client.post(
        "/api/v1/auth/login",
        json={"login_id": login_id, "password": password, "client": client_name},
    )


def test_requires_authentication(client):
    assert client.get("/api/v1/academics/institutions").status_code == 401


def test_rotation_replay_revokes_family(client):
    original = login(client).json()
    r = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": original["refresh_token"], "client": "admin-web"},
    )
    assert r.status_code == 200
    current = r.json()
    assert (
        client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer " + original["access_token"]},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": original["refresh_token"], "client": "admin-web"},
        ).status_code
        == 401
    )
    assert (
        client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer " + current["access_token"]},
        ).status_code
        == 401
    )


def test_refresh_bound_to_client(client):
    original = login(client).json()
    assert (
        client.post(
            "/api/v1/auth/refresh",
            json={
                "refresh_token": original["refresh_token"],
                "client": "teacher-mobile",
            },
        ).status_code
        == 401
    )


def test_logout_revokes_access(client, headers):
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_expired_and_tampered_tokens(client, app, headers):
    token = headers["Authorization"].split()[1]
    claims = jwt.decode(
        token,
        app.state.settings.jwt_secret,
        algorithms=["HS256"],
        audience=app.state.settings.audience,
    )
    claims["exp"] = time.time() - 5
    expired = jwt.encode(claims, app.state.settings.jwt_secret, algorithm="HS256")
    assert (
        client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer " + expired}
        ).status_code
        == 401
    )
    assert (
        client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer " + token + "broken"}
        ).status_code
        == 401
    )


def test_rate_limit(client):
    for _ in range(5):
        assert login(client, password="bad").status_code == 401
    assert login(client, password="bad").status_code == 429


def test_password_change_revokes_sessions(client, headers):
    assert (
        client.post(
            "/api/v1/auth/change-password",
            headers=headers,
            json={
                "current_password": "Strong-Test-Password-245!",
                "new_password": "Changed-Password-274!",
            },
        ).status_code
        == 204
    )
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert login(client, password="Changed-Password-274!").status_code == 200


def test_roles_accounts_and_permissions(client, headers, seeded):
    r = client.post(
        "/api/v1/administration/roles",
        headers=headers,
        json={"name": "Fee Viewer", "permissions": {"student_fee_charges": ["view"]}},
    )
    assert r.status_code == 201, r.text
    role = r.json()["code"]
    r = client.post(
        "/api/v1/administration/accounts",
        headers=headers,
        json={
            "login_id": "teacher.one",
            "password": "Employee-Password-249!",
            "person_type": "employee",
            "person_code": "E1",
            "role_codes": [role],
            "clients": ["admin-web", "teacher-mobile"],
        },
    )
    assert r.status_code == 201, r.text
    assert "password_hash" not in r.json() and "password" not in r.json()
    account = r.json()["code"]
    employee = login(
        client, login_id="teacher.one", password="Employee-Password-249!"
    ).json()
    eh = {"Authorization": "Bearer " + employee["access_token"]}
    assert (
        client.get("/api/v1/finance/student-fee-charges", headers=eh).status_code == 200
    )
    assert client.get("/api/v1/administration/accounts", headers=eh).status_code == 403
    assert (
        client.delete(
            "/api/v1/administration/roles/" + role, headers=headers
        ).status_code
        == 409
    )
    assert (
        client.put(
            "/api/v1/administration/roles/" + role,
            headers=headers,
            json={"name": "No Access", "permissions": {}},
        ).status_code
        == 200
    )
    assert (
        client.get("/api/v1/finance/student-fee-charges", headers=eh).status_code == 403
    )
    assert (
        client.patch(
            "/api/v1/administration/accounts/" + account,
            headers=headers,
            json={"active": False},
        ).status_code
        == 200
    )
    assert client.get("/api/v1/auth/me", headers=eh).status_code == 401


def test_prevent_role_privilege_escalation(client, headers):
    assert (
        client.post(
            "/api/v1/administration/roles",
            headers=headers,
            json={"name": "Backdoor", "permissions": {"accounts": ["create"]}},
        ).status_code
        == 201
    )
    assert (
        client.delete("/api/v1/administration/roles/ROOT", headers=headers).status_code
        == 409
    )


def test_no_public_credentials_api(client, headers):
    assert (
        client.get("/api/v1/access-control/users", headers=headers).status_code == 404
    )
