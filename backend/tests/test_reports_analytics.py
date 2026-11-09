from tests.test_fee_payments_and_cash import college, pay  # noqa: F401  (fixture)

URL = "/api/v1/dashboard/reports-analytics"


def test_reports_analytics_rows_carry_course_branch_and_year(client, headers, college):  # noqa: F811
    assert pay(client, headers, fee_head_code="TUI", amount="400").status_code == 201
    body = client.get(URL, headers=headers)
    assert body.status_code == 200, body.text
    data = body.json()
    student = next(s for s in data["students"] if s["code"] == "S1")
    assert (student["level"], student["program_code"], student["year_code"]) == ("degree", "BCA", "Y")
    charge = next(c for c in data["charges"] if c["student_code"] == "S1")
    assert (charge["billed"], charge["paid"], charge["outstanding"], charge["program_code"]) == (1000.0, 400.0, 600.0, "BCA")
    assert charge["days_overdue"] > 0 and charge["late_fee"] is False  # due 2026-07-01
    assert data["payments"][0]["amount"] == 400.0 and data["payments"][0]["program_code"] == "BCA"
    assert {p["code"] for p in data["programs"]} >= {"BCA"} and "summary" in data["late_fees"]
    assert any(l["key"] == "degree" for l in data["levels"])
    assert data["payments"][0]["student"] == "Asha Rao" and data["payments"][0]["receipt_number"] == "RCT-0001"
