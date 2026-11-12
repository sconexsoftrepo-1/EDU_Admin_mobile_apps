from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from app.core import late_fees
from tests.test_fee_payments_and_cash import PAY, college  # noqa: F401  (fixture)

LATE = "/api/v1/finance/late-fees"
IST = ZoneInfo("Asia/Kolkata")


def at(day, hour):
    return datetime.fromisoformat(f"{day}T{hour:02d}:30:00").replace(tzinfo=IST)


@pytest.fixture
def family(college):  # noqa: F811
    with college.state.store.transaction() as d:
        d["accounts"]["SA"] = {"code": "SA", "person_type": "student", "person_code": "S1", "active": True}
        d["accounts"]["PA"] = {"code": "PA", "person_type": "parent", "person_code": "PAR", "active": True}
        d["records"]["student_parents"] = {"SP": {"code": "SP", "student_code": "S1", "parent_code": "PAR"}}
        d["records"]["fee_structures"]["FS"].update(semester_number=1, fee_basis="semester", late_fee_amount="2000")
        d["records"]["student_fee_charges"]["C1"]["due_date"] = "2026-11-20"
    return college


def test_three_reminders_a_day_from_six_days_before_until_paid(family):
    store = family.state.store
    with store.transaction() as d:
        assert late_fees.fee_reminders(d, at("2026-11-13", 10)) == []  # seven days before: not yet
        first = late_fees.fee_reminders(d, at("2026-11-14", 10))
        assert len(first) == 2  # student and parent
        notice = d["records"]["notifications"][first[0]]
        assert notice["title"] == "6 days left to pay the Semester 1 fee"
        assert "remaining balance of Semester 1 fee" in notice["body"] and "₹1,000" in notice["body"]
        assert "late fee of ₹2,000" in notice["body"]
        assert late_fees.fee_reminders(d, at("2026-11-14", 11)) == []  # same slot: no repeat
        assert len(late_fees.fee_reminders(d, at("2026-11-14", 14))) == 2
        assert len(late_fees.fee_reminders(d, at("2026-11-14", 19))) == 2  # third of the day
        assert late_fees.fee_reminders(d, at("2026-11-15", 8)) == []  # before the first slot
        last = late_fees.fee_reminders(d, at("2026-11-20", 9))
        assert d["records"]["notifications"][last[0]]["title"] == "Last day to pay the Semester 1 fee"
        # Paid: the reminders stop.
        d["records"]["payments"] = {"P": {"code": "P", "student_code": "S1", "amount": "1000", "status": "settled",
                                          "paid_on": "2026-11-20", "method": "cash", "currency": "INR"}}
        d["records"]["payment_allocations"] = {"A": {"code": "A", "payment_code": "P", "charge_code": "C1", "amount": "1000"}}
        assert late_fees.fee_reminders(d, at("2026-11-20", 13)) == []


def test_late_fee_is_added_once_after_the_due_date_and_only_admin_cancels(client, headers, family):
    store = family.state.store
    with store.transaction() as d:
        assert late_fees.apply_late_fees(d, datetime(2026, 11, 20).date()) == []  # due day: no late fee yet
        added = late_fees.apply_late_fees(d, datetime(2026, 11, 21).date())
        assert len(added) == 2 and "late fee of ₹2,000" in d["records"]["notifications"][added[0]]["body"]
        assert late_fees.apply_late_fees(d, datetime(2026, 11, 22).date()) == []  # once per semester
    ledger = client.get("/api/v1/finance/students/S1/ledger", headers=headers).json()
    assert ledger["totals"]["outstanding"] == "3000.00"
    assert any(c["fee_head"] == "Late fee" for c in ledger["charges"])
    # The late fee head can be paid on the payment form like any other fee.
    options = client.get(f"{PAY}/options?student_code=S1", headers=headers).json()
    assert next(h for h in options["fee_heads"] if h["code"] == late_fees.LATE_HEAD)["outstanding"] == "2000.00"

    listing = client.get(LATE, headers=headers).json()
    assert listing["summary"] == {"students": 1, "cleared": 0, "uncleared": 1, "late_fee_total": "2000.00",
                                  "late_fee_pending": "2000.00", "cancelled": 0}
    student = listing["items"][0]
    assert (student["name"], student["course"], student["late_fees_applied"], student["pending"]) == \
        ("Asha Rao", "BCA", 1, "3000.00")
    key = student["late_fees"][0]["key"]
    assert student["late_fees"][0]["missed_due_date"] == "2026-11-20" and listing["can_cancel"] is True

    cancelled = client.post(f"{LATE}/{key}/cancel", headers=headers)
    assert cancelled.status_code == 200, cancelled.text
    assert client.get("/api/v1/finance/students/S1/ledger", headers=headers).json()["totals"]["outstanding"] == "1000.00"
    after = client.get(LATE, headers=headers).json()
    assert after["summary"]["cancelled"] == 1 and after["items"][0]["late_fees"][0]["status"] == "cancelled"
    assert client.post(f"{LATE}/{key}/cancel", headers=headers).status_code == 409
    with store.transaction() as d:  # a cancelled late fee is not charged again
        assert late_fees.apply_late_fees(d, datetime(2026, 11, 25).date()) == []


def test_paid_semester_gets_no_late_fee_and_cleared_students_are_counted(client, headers, family):
    with family.state.store.transaction() as d:
        late_fees.apply_late_fees(d, datetime(2026, 11, 21).date())
    # Paying the semester and the late fee clears the student.
    assert client.post(PAY, headers=headers, json={"student_code": "S1", "fee_head_code": "TUI", "amount": "1000",
                                                   "method": "cash", "paid_on": "2026-11-07"}).status_code == 201
    assert client.post(PAY, headers=headers, json={"student_code": "S1", "fee_head_code": late_fees.LATE_HEAD,
                                                   "amount": "2000", "method": "cash", "paid_on": "2026-11-07"}).status_code == 201
    listing = client.get(LATE, headers=headers).json()
    assert listing["summary"]["cleared"] == 1 and listing["summary"]["uncleared"] == 0
    key = listing["items"][0]["late_fees"][0]["key"]
    assert listing["items"][0]["late_fees"][0]["status"] == "paid"
    assert client.post(f"{LATE}/{key}/cancel", headers=headers).status_code == 409  # already paid


def test_late_fee_structures_stay_out_of_enrollment_and_the_amount_is_saved_on_the_schedule(family):
    with family.state.store.transaction() as d:
        late_fees.apply_late_fees(d, datetime(2026, 11, 21).date())
        structures = d["records"]["fee_structures"]
        late = [s for s in structures.values() if s.get("fee_basis") == "late_fee"]
        assert len(late) == 1 and late[0]["fee_head_code"] == late_fees.LATE_HEAD
        from app.modules.master_data.enrollment.api import fee_lines
        assert [line["fee_head_code"] for line in fee_lines(d, "BCA", "Y", False, False, year_of_study=1)] == ["TUI"]


def test_late_fee_amount_is_saved_with_the_fee_schedule(client, app):
    from tests.test_master_data import fee_schedule_setup
    h = fee_schedule_setup(app, client)
    values = {"program_code": "INT-MPC", "academic_year_code": "AY", "year_of_study": 1, "due_date": "2026-06-15",
              "late_fee_amount": "1500", "lines": [{"name": "Tuition fee", "category": "academic", "amount": "3500.00"}]}
    made = client.post("/api/v1/master-data/actions/course-fee-structure", headers=h, json={"values": values})
    assert made.status_code == 201, made.text
    assert made.json()["fee_structures"][0]["late_fee_amount"] == "1500.00"


def test_app_popup_alert_counts_down_then_shows_the_late_fee(family):
    from datetime import date
    with family.state.store.transaction() as d:
        assert late_fees.fee_alert(d, {"S1"}, date(2026, 11, 13)) is None  # a week out: no popup yet
        soon = late_fees.fee_alert(d, {"S1"}, date(2026, 11, 17))
        assert (soon["level"], soon["days_left"], soon["balance"], soon["late_fee_amount"]) == \
            ("due_soon", 3, "1000.00", "2000.00")
        last = late_fees.fee_alert(d, {"S1"}, date(2026, 11, 20))
        assert last["level"] == "last_day" and last["student_name"] == "Asha Rao"
        late_fees.apply_late_fees(d, date(2026, 11, 21))
        overdue = late_fees.fee_alert(d, {"S1"}, date(2026, 11, 21))
        assert overdue["level"] == "overdue" and overdue["late_fee_added"] is True
        assert late_fees.fee_alert(d, set(), date(2026, 11, 20)) is None  # only the signed-in family's students

