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


def test_super_admin_can_open_every_registered_screen_even_with_a_screen_allowlist(client, headers, app):
    with app.state.store.transaction() as data:
        # A legacy allowlist must never restrict the system administrator.
        data["roles"]["ROOT"]["screens"] = ["dashboard"]
    expected = json.loads((ROOT / "backend/app/contracts/screens.json").read_text())
    result = client.get("/api/v1/workspace/screens", headers=headers)
    assert result.status_code == 200
    assert {s["key"] for s in result.json()["screens"]} == {s["key"] for s in expected}
    for screen in expected:
        response = client.get("/api/v1/workspace/screens/" + screen["key"], headers=headers)
        assert response.status_code == 200, (screen["key"], response.text)
