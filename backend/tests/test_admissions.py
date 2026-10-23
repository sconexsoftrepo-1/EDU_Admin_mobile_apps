def seed_admission(app):
    with app.state.store.transaction() as d:
        d["records"] = {
            "employees": {"ADMIN-EMP": {"code": "ADMIN-EMP"}},
            "campuses": {"CAMP": {"code": "CAMP"}},
            "admission_applications": {
                "APP": {
                    "code": "APP",
                    "program_code": "PRG",
                    "academic_year_code": "AY",
                    "first_name": "Student",
                    "last_name": "Example",
                    "status": "accepted",
                    "admission_category": "regular",
                    "date_of_birth": "2008-01-01",
                    "consent_at": "2026-10-01T09:00:00+00:00",
                    "source_code": "SRC",
                }
            },
            "admission_sources": {
                "SRC": {"code": "SRC", "name": "Website", "channel": "website"}
            },
            "application_qualifications": {
                "Q1": {
                    "code": "Q1",
                    "application_code": "APP",
                    "result_status": "passed",
                }
            },
            "admission_reviews": {
                "R1": {
                    "code": "R1",
                    "application_code": "APP",
                    "reviewer_employee_code": "ADMIN-EMP",
                    "decision": "eligible",
                    "reviewed_at": "2026-10-05T09:00:00+00:00",
                }
            },
            "sections": {
                "SEC": {
                    "code": "SEC",
                    "batch_code": "BAT",
                    "semester_code": "SEM",
                    "capacity": 30,
                }
            },
            "semesters": {"SEM": {"code": "SEM", "academic_year_code": "AY"}},
            "batches": {"BAT": {"code": "BAT", "program_code": "PRG"}},
            "application_guardians": {
                "G": {
                    "code": "G",
                    "application_code": "APP",
                    "first_name": "Parent",
                    "last_name": "Example",
                    "phone": "9876543210",
                    "is_primary": True,
                    "relationship": "mother",
                }
            },
            "document_types": {
                "DOC": {
                    "code": "DOC",
                    "original_sighting_required": True,
                    "expiry_required": False,
                }
            },
            "program_document_requirements": {
                "REQ": {
                    "code": "REQ",
                    "program_code": "PRG",
                    "academic_year_code": "AY",
                    "document_type_code": "DOC",
                    "admission_category": "all",
                    "required_stage": "submission",
                    "is_required": True,
                    "waiver_allowed": False,
                }
            },
            "admission_documents": {
                "D1": {
                    "code": "D1",
                    "application_code": "APP",
                    "document_type_code": "DOC",
                    "is_current": True,
                    "status": "received",
                    "original_sighted": True,
                    "original_sighted_by_code": "ADMIN-EMP",
                    "original_sighted_at": "2026-10-20T09:00:00+00:00",
                    "storage_key": "secure/intake.pdf",
                    "original_filename": "intake.pdf",
                    "mime_type": "application/pdf",
                    "size_bytes": 1024,
                    "sha256": "a" * 64,
                }
            },
        }


def details():
    return {
        "section_code": "SEC",
        "roll_number": "ROLL1",
        "student_details": {
            "campus_code": "CAMP",
            "admission_number": "ADM1",
            "date_of_birth": "2008-01-01",
            "gender": "female",
            "admission_date": "2026-10-22",
            "address": "Example address",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "postal_code": "600001",
            "country": "India",
            "emergency_contact_name": "Parent Example",
            "emergency_contact_phone": "9876543210",
        },
    }


def test_document_gate_and_atomic_enrollment(client, headers, app):
    seed_admission(app)
    path = "/api/v1/admissions/applications/APP/enroll"
    response = client.post(path, headers=headers, json=details())
    assert response.status_code == 409, response.text
    assert not app.state.store.snapshot()["records"].get("students")
    assert (
        client.post(
            "/api/v1/admissions/documents/D1/review",
            headers=headers,
            json={"status": "verified", "reason": "Original and scanned copy checked"},
        ).status_code
        == 200
    )
    response = client.post(path, headers=headers, json=details())
    assert response.status_code == 201, response.text
    data = app.state.store.snapshot()
    assert data["records"]["admission_applications"]["APP"]["status"] == "enrolled"
    assert (
        len(data["records"]["students"]) == 1 and len(data["records"]["parents"]) == 1
    )
    assert len(data["records"]["student_document_links"]) == 1
    assert client.post(path, headers=headers, json=details()).status_code == 409


def test_enrollment_invalid_student_details_rolls_back(client, headers, app):
    seed_admission(app)
    with app.state.store.transaction() as d:
        d["records"]["admission_documents"]["D1"].update(
            status="verified",
            reviewed_by_employee_code="ADMIN-EMP",
            reviewed_at="2026-10-21T09:00:00+00:00",
        )
    body = details()
    body["student_details"].pop("date_of_birth")
    assert (
        client.post(
            "/api/v1/admissions/applications/APP/enroll", headers=headers, json=body
        ).status_code
        == 422
    )
    d = app.state.store.snapshot()
    assert not d["records"].get("students") and not d["records"].get("parents")
    assert d["records"]["admission_applications"]["APP"]["status"] == "accepted"


def test_document_original_sighting_required(client, headers, app):
    seed_admission(app)
    with app.state.store.transaction() as d:
        d["records"]["admission_documents"]["D1"]["original_sighted"] = False
    assert (
        client.post(
            "/api/v1/admissions/documents/D1/review",
            headers=headers,
            json={"status": "verified", "reason": "Scan appears correct"},
        ).status_code
        == 422
    )


def test_manifest_list_endpoints_and_openapi(client, headers):
    manifest = client.get("/api/v1/manifest").json()
    for entry in manifest:
        if entry["generic_api"]:
            response = client.get(entry["path"], headers=headers)
            assert response.status_code == 200, (entry["path"], response.text)
    spec = client.get("/openapi.json")
    assert spec.status_code == 200
    assert "/api/v1/auth/refresh" in spec.json()["paths"]
