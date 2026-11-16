"""One screen for logins: no staff passwords, extra screens per login, activate / deactivate / delete."""
ACCOUNTS = "/api/v1/administration/accounts"


def roles(app):
    with app.state.store.transaction() as d:
        d["roles"]["ROOT"]["system_admin"] = True
        d["roles"]["CLERK"] = {"code": "CLERK", "name": "Office clerk", "scope": "college", "system_admin": False,
                               "permissions": {"students": ["view"]}, "screens": ["students"]}
        d["records"]["employees"]["E7"] = {"code": "E7", "first_name": "Ravi", "employee_type": "staff"}


def test_admin_login_with_only_login_id_and_email(client, app, headers):
    roles(app)
    made = client.post(ACCOUNTS, headers=headers, json={
        "login_id": "akhil", "email": "akhil.admin@pragathiews.org", "person_type": "system",
        "role_codes": ["ROOT"], "clients": ["admin-web", "admin-mobile"]})
    assert made.status_code == 201, made.text
    body = made.json()
    assert body["active"] is True and "password" not in made.text and "password_hash" not in body
    listed = client.get("/api/v1/administration/roles", headers=headers).json()
    root = next(r for r in listed if r["code"] == "ROOT")
    assert "akhil" in {a["login_id"] for a in root["assigned_accounts"]}
    # The same email cannot be used twice.
    again = client.post(ACCOUNTS, headers=headers, json={
        "login_id": "akhil2", "email": "Akhil.Admin@pragathiews.org", "person_type": "system",
        "role_codes": ["ROOT"], "clients": ["admin-web"]})
    assert again.status_code == 409


def test_extra_screens_add_to_the_role(client, app, headers):
    roles(app)
    made = client.post(ACCOUNTS, headers=headers, json={
        "login_id": "ravi.clerk", "email": "ravi@pragathiews.org", "person_type": "employee", "person_code": "E7",
        "role_codes": ["CLERK"], "clients": ["admin-web"], "extra_access": {"payments": "view"}})
    assert made.status_code == 201, made.text
    from app.core.security import has_permission, role_limit
    with app.state.store.transaction() as d:
        user = d["accounts"][made.json()["code"]]
        assert has_permission(d, user, "students", "view")
        assert has_permission(d, user, "fee_payments", "view") or has_permission(d, user, "payments", "view")
        assert not has_permission(d, user, "students", "delete")
        assert {"students", "payments"} <= role_limit(d, user, "screens")
    bad = client.patch(ACCOUNTS + "/" + made.json()["code"], headers=headers, json={"extra_access": {"nope": "view"}})
    assert bad.status_code == 422


def test_activate_deactivate_and_delete(client, app, headers):
    roles(app)
    code = client.post(ACCOUNTS, headers=headers, json={
        "login_id": "temp.staff", "email": "temp@pragathiews.org", "person_type": "employee", "person_code": "E7",
        "role_codes": ["CLERK"], "clients": ["admin-web"]}).json()["code"]
    assert client.patch(f"{ACCOUNTS}/{code}", headers=headers, json={"active": False}).json()["active"] is False
    assert client.patch(f"{ACCOUNTS}/{code}", headers=headers, json={"active": True}).json()["active"] is True
    with app.state.store.transaction() as d:
        d["records"].setdefault("device_tokens", {})["DT1"] = {"code": "DT1", "user_code": code, "token": "t"}
    assert client.delete(f"{ACCOUNTS}/{code}", headers=headers).status_code == 204
    with app.state.store.transaction() as d:
        assert code not in d["accounts"] and "DT1" not in d["records"]["device_tokens"]


def test_admins_cannot_lock_everyone_out(client, app, headers):
    roles(app)
    assert client.patch(f"{ACCOUNTS}/ADMIN", headers=headers, json={"active": False}).status_code == 409
    assert client.delete(f"{ACCOUNTS}/ADMIN", headers=headers).status_code == 409


def test_logins_with_history_are_deactivated_not_deleted(client, app, headers):
    roles(app)
    code = client.post(ACCOUNTS, headers=headers, json={
        "login_id": "busy.staff", "email": "busy@pragathiews.org", "person_type": "employee", "person_code": "E7",
        "role_codes": ["CLERK"], "clients": ["admin-web"]}).json()["code"]
    with app.state.store.transaction() as d:
        d["records"].setdefault("import_jobs", {})["IJ1"] = {"code": "IJ1", "uploaded_by_code": code}
    refused = client.delete(f"{ACCOUNTS}/{code}", headers=headers)
    assert refused.status_code == 409 and "Deactivate" in refused.text


def test_teaching_roles_need_an_employee_record(client, app, headers):
    roles(app)
    with app.state.store.transaction() as d:
        d["roles"]["FACULTY"] = {"code": "FACULTY", "name": "Faculty", "scope": "teaching", "system_admin": False, "permissions": {}}
    r = client.post(ACCOUNTS, headers=headers, json={"login_id": "t1", "email": "t1@pragathiews.org", "person_type": "system",
                                                     "role_codes": ["FACULTY"], "clients": ["teacher-mobile"]})
    assert r.status_code == 422
