"""Tables a route reads are remembered per route, so the next visit can read them in one batch."""
from app.core import sql_store


def test_routes_remember_their_tables_and_stay_separate():
    sql_store._ROUTE_TABLES.clear()
    token = sql_store._REQUEST_ROUTE.set("GET /api/v1/dashboard/overview")
    try:
        assert sql_store._learned() is None  # nothing yet
        sql_store._learn("students")
        assert sql_store._learned() is None  # one table is not worth a batch
        sql_store._learn("payments")
        assert sql_store._learned() == {"students", "payments"}
    finally:
        sql_store._REQUEST_ROUTE.reset(token)
    other = sql_store._REQUEST_ROUTE.set("GET /api/v1/fees")
    try:
        assert sql_store._learned() is None
    finally:
        sql_store._REQUEST_ROUTE.reset(other)
    assert sql_store._learned() is None  # outside a request: no route, no prefetch
    sql_store._learn("anything")          # and nothing is recorded


def test_route_memory_is_bounded():
    sql_store._ROUTE_TABLES.clear()
    for i in range(sql_store._ROUTE_LIMIT + 50):
        token = sql_store._REQUEST_ROUTE.set(f"GET /students/{i}")
        sql_store._learn("students")
        sql_store._REQUEST_ROUTE.reset(token)
    assert len(sql_store._ROUTE_TABLES) == sql_store._ROUTE_LIMIT
    assert "GET /students/0" not in sql_store._ROUTE_TABLES  # oldest forgotten first
    sql_store._ROUTE_TABLES.clear()
