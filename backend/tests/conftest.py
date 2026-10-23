import secrets

import pytest
from fastapi.testclient import TestClient

from app.core.security import hasher
from app.core.settings import Settings
from app.main import create_app

from tests import sql_support


@pytest.fixture(scope="session")
def sql_schema():
    """Private PostgreSQL schema for EDUNEXA_TEST_STORAGE=postgres runs."""
    if not sql_support.ENABLED:
        yield None
        return
    sql_support.settings_env()
    sql_support.install()
    try:
        yield sql_support.SCHEMA
    finally:
        sql_support.drop()


def _sql_app(app):
    store = app.state.store
    conn = store.pool.get()
    sql_support.wipe(store._meta(conn))
    store.pool.put(conn)
    real = store.transaction

    def transaction(prepare=None):
        # Fixture writes from test files are partial by design; complete them for the schema.
        if prepare is None and sql_support.caller_is_test():
            prepare = sql_support.complete
        return real(prepare)

    store.transaction = transaction
    return app


@pytest.fixture
def app(tmp_path, sql_schema):
    app = create_app(
        Settings(
            jwt_secret=secrets.token_urlsafe(64),
            data_dir=tmp_path,
            storage_backend="postgres" if sql_schema else "local-json",
            # Requests to a remote database are slow; keep tokens valid for long tests.
            **({"access_minutes": 30} if sql_schema else {}),
        )
    )
    if sql_schema:
        _sql_app(app)
    with app.state.store.transaction() as data:
        data["roles"]["ROOT"] = {
            "code": "ROOT",
            "name": "System Admin",
            "system_admin": True,
            "permissions": {},
        }
        data["accounts"]["ADMIN"] = {
            "code": "ADMIN",
            "login_id": "admin",
            "password_hash": hasher.hash("Strong-Test-Password-245!"),
            "active": True,
            "person_type": "employee",
            "person_code": "ADMIN-EMP",
            "role_codes": ["ROOT"],
            "clients": ["admin-web", "admin-mobile"],
        }
    with app.state.store.transaction() as data:
        data["records"].setdefault("employees", {})["ADMIN-EMP"] = {
            "code": "ADMIN-EMP",
            "first_name": "Test",
            "last_name": "Administrator",
        }
    yield app
    if sql_schema:
        app.state.store.close()  # release connections so the test schema can be dropped


@pytest.fixture
def client(app):
    with TestClient(app) as c:
        yield c


@pytest.fixture
def headers(client):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "login_id": "admin",
            "password": "Strong-Test-Password-245!",
            "client": "admin-web",
        },
    )
    assert response.status_code == 200, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}


@pytest.fixture
def seeded(app):
    # Data access unit fixtures intentionally bypass API input requirements; integration tests below test validation.
    with app.state.store.transaction() as d:
        d["records"] = {
            "students": {
                "S1": {
                    "code": "S1",
                    "first_name": "A",
                    "last_name": "Student",
                    "admission_number": "ADM1",
                },
                "S2": {
                    "code": "S2",
                    "first_name": "B",
                    "last_name": "Student",
                    "admission_number": "ADM2",
                },
            },
            "fee_heads": {
                "FH": {
                    "code": "FH",
                    "name": "Tuition",
                    "collection_ownership": "internal",
                    "scholarship_eligible": True,
                }
            },
            "fee_structures": {
                "FS": {"code": "FS", "fee_head_code": "FH", "currency": "INR"}
            },
            "student_fee_charges": {
                "C1": {
                    "code": "C1",
                    "student_code": "S1",
                    "fee_structure_code": "FS",
                    "amount": "1000.00",
                    "tax_amount": "0.00",
                    "due_date": "2026-11-01",
                }
            },
            "employees": {
                # ADMIN keeps its own employee identity; E1 is the teacher.
                "ADMIN-EMP": {
                    "code": "ADMIN-EMP",
                    "first_name": "Test",
                    "last_name": "Administrator",
                    "campus_code": "ADMIN-CAMPUS",
                    "status": "active",
                },
                "E1": {"code": "E1", "first_name": "Teacher", "last_name": "One"},
            },
            "scholarships": {"SCH": {"code": "SCH", "maximum_amount": "500.00"}},
            "student_scholarships": {
                "AW": {
                    "code": "AW",
                    "student_code": "S1",
                    "scholarship_code": "SCH",
                    "amount": "200.00",
                    "status": "pending",
                }
            },
        }
    return app
