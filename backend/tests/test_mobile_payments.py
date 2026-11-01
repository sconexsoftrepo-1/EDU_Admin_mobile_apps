from tests.test_screen_workflows import classroom, mobile_login


def test_parent_payment_history_shows_time_and_what_each_payment_settled(client, seeded, headers):
    classroom(seeded)
    paid = client.post(
        "/api/v1/finance/collect",
        headers={**headers, "Idempotency-Key": "partial-payment-0001"},
        json={"student_code": "S1", "method": "cash", "transaction_reference": "CASH-0001",
              "paid_on": "2026-10-22", "allocations": {"C1": "400.00"}},
    )
    assert paid.status_code == 201, paid.text
    assert paid.json()["payment"]["recorded_at"]

    parent = mobile_login(client, seeded, "parent", "P1", "parent-mobile")
    items = client.get("/api/v1/mobile/workspace/payments", headers=parent).json()["items"]
    payment = next(p for p in items if p["transaction_reference"] == "CASH-0001")
    assert payment["recorded_at"]
    assert payment["allocations"] == [
        {"charge_code": "C1", "amount": "400.00", "fee_head": "Tuition", "semester_number": None}
    ]
    assert payment["receipts"]
