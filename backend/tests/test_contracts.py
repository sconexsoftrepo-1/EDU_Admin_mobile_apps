import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_dashboard_screen_catalog_matches_backend_contract():
    """The admin dashboard builds its sidebar from a copy of the screen contract."""
    backend = json.loads((ROOT / "backend/app/contracts/screens.json").read_text())
    copy = ROOT / "admin-dashboard/src/services/api/modules/workspace/screens.json"
    assert json.loads(copy.read_text()) == backend, f"Copy backend/app/contracts/screens.json to {copy}"


def test_login_returns_roles_for_navigation(client):
    response = client.post("/api/v1/auth/login", json={"login_id": "admin", "password": "Strong-Test-Password-245!",
                                                       "client": "admin-web"})
    assert response.status_code == 200
    roles = response.json()["roles"]
    assert [r["code"] for r in roles] == ["ROOT"] and roles[0]["system_admin"] is True
