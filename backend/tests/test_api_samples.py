"""Read endpoints of the admin portal answer with data. tools/generate_api_reference.py also records
these responses as the samples shown in /docs and docs/API_REFERENCE.txt."""


def test_admin_read_endpoints_answer(client, headers, app):
    form = client.post("/api/v1/forms", headers=headers, json={
        "name": "Student extra details", "screen": "students", "published": True,
        "fields": [{"key": "hobby", "label": "Hobby", "required": False}]})
    assert form.status_code == 201, form.text
    with app.state.store.transaction() as d:
        d["records"].setdefault("students", {})["S1"] = {"code": "S1", "first_name": "Kiran", "last_name": "Patel"}
        d["records"].setdefault("programs", {})["BCOM"] = {"code": "BCOM", "department_code": "DEP", "name": "B.Com",
                                                           "qualification": "B.Com", "duration_semesters": 6}
        d["records"].setdefault("batches", {})["BCOM-2026"] = {"code": "BCOM-2026", "program_code": "BCOM",
                                                               "name": "2026-29", "entry_year": 2026,
                                                               "graduation_year": 2029}
    for path in ["/api/v1/auth/roles", "/api/v1/administration/screens", "/api/v1/administration/roles",
                 "/api/v1/administration/accounts", "/api/v1/administration/audit?offset=0&limit=5",
                 "/api/v1/forms", f"/api/v1/forms/{form.json()['code']}", "/api/v1/workflows",
                 "/api/v1/workspace/lookups/students", "/api/v1/workspace/resources/students/form",
                 "/api/v1/public/options", "/api/v1/integrations/status", "/api/v1/finance/cashbook"]:
        response = client.get(path, headers=headers)
        assert response.status_code == 200, (path, response.text)
    promoted = client.post("/api/v1/master-data/enrollment/promote?batch_code=BCOM-2026&to_year=2", headers=headers)
    assert promoted.status_code == 200, promoted.text
