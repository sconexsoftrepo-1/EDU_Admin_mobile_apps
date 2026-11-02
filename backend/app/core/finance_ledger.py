"""Cash ledger and receipts register, grouped by day, week, month or year.

Money in: settled fee payments (one receipt each). Money out: expense payments and fee refunds.
Each group has the receipt count, amount received by mode of payment, payments out, net and the
running (closing) balance; the PDF adds the day-by-day entries with receipt and transaction numbers.

    GET /api/v1/finance/ledger?period=day|week|month|year&start=&end=&mode=all|cash
    GET /api/v1/finance/ledger/pdf?…   (same, as a formatted PDF)
"""
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response

from . import assignment_workspace as aw
from .finance_pdfs import METHODS
from .pdf_kit import Document, amount, inr
from .security import current_user, has_permission

router = APIRouter(prefix="/finance/ledger", tags=["Cash ledger"])
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November",
          "December"]
DEFAULT_SPAN = {"day": 30, "week": 7 * 12, "month": 365, "year": 365 * 5}


def allowed(data, user):
    return user.get("person_type") in {"employee", "system"} and any(
        has_permission(data, user, t, "view") for t in ("reports", "payments", "receipts"))


def entries(data, mode="all"):
    """Every money movement with date, voucher, particulars, mode and amount in / out."""
    records = data["records"]
    receipts = {r.get("payment_code"): r for r in aw.rows(data, "receipts")}
    students = records.get("students", {})
    rows = []
    for p in aw.rows(data, "payments"):
        if p.get("status") != "settled" or (mode == "cash" and p.get("method") != "cash"):
            continue
        s = students.get(p.get("student_code"), {})
        rows.append({"date": str(p.get("paid_on") or "")[:10], "voucher": receipts.get(p["code"], {}).get("receipt_number") or p["code"],
                     "kind": "receipt", "particulars": f"Fee — {' '.join(aw.name(s).split()) or p.get('student_code')}"
                                                       f"{' (' + s['admission_number'] + ')' if s.get('admission_number') else ''}",
                     "mode": p.get("method") or "", "reference": p.get("transaction_reference") or "", "in": amount(p.get("amount")),
                     "out": Decimal("0")})
    expenses = records.get("expenses", {})
    for e in aw.rows(data, "expense_payment_entries"):
        if mode == "cash" and e.get("method") != "cash":
            continue
        ex = expenses.get(e.get("expense_code"), {})
        rows.append({"date": str(e.get("paid_on") or "")[:10], "voucher": e["code"], "kind": "payment",
                     "particulars": f"Expense — {ex.get('description') or ex.get('category') or e.get('expense_code')}",
                     "mode": e.get("method") or "", "reference": e.get("reference") or "", "in": Decimal("0"), "out": amount(e.get("amount"))})
    payments = records.get("payments", {})
    for r in aw.rows(data, "refunds"):
        method = payments.get(r.get("payment_code"), {}).get("method")
        if mode == "cash" and method != "cash":
            continue
        rows.append({"date": str(r.get("refunded_on") or "")[:10], "voucher": r["code"], "kind": "refund",
                     "particulars": "Fee refund", "mode": method or "", "reference": r.get("reference") or "",
                     "in": Decimal("0"), "out": amount(r.get("amount"))})
    return sorted((r for r in rows if r["date"]), key=lambda r: (r["date"], r["voucher"]))


def bucket(day: date, period):
    if period == "day":
        return day.isoformat(), day.strftime("%a, ") + f"{day.day} {MONTHS[day.month - 1][:3]} {day.year}"
    if period == "week":
        monday = day - timedelta(days=day.weekday())
        sunday = monday + timedelta(days=6)
        return monday.isoformat(), f"{monday.day} {MONTHS[monday.month - 1][:3]} – {sunday.day} {MONTHS[sunday.month - 1][:3]} {sunday.year}"
    if period == "month":
        return day.strftime("%Y-%m"), f"{MONTHS[day.month - 1]} {day.year}"
    return str(day.year), str(day.year)


def ledger(data, period="month", start=None, end=None, mode="all"):
    if period not in DEFAULT_SPAN:
        raise HTTPException(422, "Period must be day, week, month or year")
    end = end or date.today()
    start = start or end - timedelta(days=DEFAULT_SPAN[period])
    if start > end:
        raise HTTPException(422, "Start date is after end date")
    rows = entries(data, mode)
    opening = sum((r["in"] - r["out"] for r in rows if r["date"] < start.isoformat()), Decimal("0"))
    running = opening
    groups, detail = {}, []
    for r in rows:
        if not start.isoformat() <= r["date"] <= end.isoformat():
            continue
        running += r["in"] - r["out"]
        detail.append({**r, "balance": running})
        key, label = bucket(date.fromisoformat(r["date"]), period)
        g = groups.setdefault(key, {"key": key, "label": label, "receipts": 0, "received": Decimal("0"), "payments": 0,
                                    "paid_out": Decimal("0"), "by_mode": {}, "count_by_mode": {}})
        if r["in"]:
            g["receipts"] += 1
            g["received"] += r["in"]
            g["by_mode"][r["mode"]] = g["by_mode"].get(r["mode"], Decimal("0")) + r["in"]
            g["count_by_mode"][r["mode"]] = g["count_by_mode"].get(r["mode"], 0) + 1
        if r["out"]:
            g["payments"] += 1
            g["paid_out"] += r["out"]
        g["closing"] = running
    items, balance = [], opening
    for key in sorted(groups):
        g = groups[key]
        g["opening"] = balance
        g["net"] = g["received"] - g["paid_out"]
        balance = g["closing"]
        items.append(g)
    modes = {}
    for r in detail:
        if r["in"]:
            m = modes.setdefault(r["mode"], {"mode": r["mode"], "label": METHODS.get(r["mode"], r["mode"].title()), "count": 0,
                                             "amount": Decimal("0")})
            m["count"] += 1
            m["amount"] += r["in"]
    totals = {"receipts": sum(g["receipts"] for g in items), "received": sum((g["received"] for g in items), Decimal("0")),
              "payments": sum(g["payments"] for g in items), "paid_out": sum((g["paid_out"] for g in items), Decimal("0")),
              "opening": opening, "closing": running}
    return {"period": period, "mode": mode, "start": start.isoformat(), "end": end.isoformat(), "groups": items,
            "by_mode": sorted(modes.values(), key=lambda m: -m["amount"]), "totals": totals, "entries": detail}


def as_json(result):
    def clean(value):
        if isinstance(value, Decimal):
            return str(value)
        if isinstance(value, dict):
            return {k: clean(v) for k, v in value.items()}
        if isinstance(value, list):
            return [clean(v) for v in value]
        return value
    return clean(result)


def ledger_pdf(data, result):
    period, totals = result["period"], result["totals"]
    title = "CASH LEDGER" if result["mode"] == "cash" else "RECEIPTS & CASH LEDGER"
    doc = Document(data, title, f"{period.title()}-wise · {result['start']} to {result['end']}",
                   reference=f"{totals['receipts']} receipt(s) · {totals['payments']} payment(s)")
    doc.tiles([("Opening balance", f"INR {inr(totals['opening'])}", f"As on {result['start']}"),
               ("Received", f"INR {inr(totals['received'])}", f"{totals['receipts']} receipts"),
               ("Paid out", f"INR {inr(totals['paid_out'])}", f"{totals['payments']} payments"),
               ("Closing balance", f"INR {inr(totals['closing'])}", f"As on {result['end']}")])
    doc.section(f"{period.title()}-wise summary")
    doc.table(["Period", "Receipts", "Received", "Payments", "Paid out", "Net", "Closing balance"],
              [[g["label"], g["receipts"], inr(g["received"]), g["payments"], inr(g["paid_out"]), inr(g["net"]), inr(g["closing"])]
               for g in result["groups"]],
              widths=[2.4, 0.9, 1.5, 0.9, 1.4, 1.4, 1.6], align="LRRRRRR",
              totals=["Total", totals["receipts"], inr(totals["received"]), totals["payments"], inr(totals["paid_out"]),
                      inr(totals["received"] - totals["paid_out"]), inr(totals["closing"])], font=8.2)
    if result["by_mode"]:
        doc.section("Receipts by mode of payment")
        doc.table(["Mode of payment", "Receipts", "Amount (INR)", "Share"],
                  [[m["label"], m["count"], inr(m["amount"]),
                    f"{(m['amount'] * 100 / totals['received']).quantize(Decimal('0.1')) if totals['received'] else 0}%"]
                   for m in result["by_mode"]], widths=[3, 1, 2, 1], align="LRRR",
                  totals=["Total", totals["receipts"], inr(totals["received"]), "100%"])
    doc.section("Ledger entries")
    doc.table(["Date", "Receipt / voucher", "Particulars", "Mode", "Transaction no.", "In", "Out", "Balance"],
              [[r["date"], r["voucher"][-16:], r["particulars"], METHODS.get(r["mode"], r["mode"].title()), r["reference"] or "—",
                inr(r["in"]) if r["in"] else "", inr(r["out"]) if r["out"] else "", inr(r["balance"])] for r in result["entries"]],
              widths=[1.1, 1.6, 2.8, 1.1, 1.6, 1.2, 1.2, 1.3], align="LLLLLRRR", font=7.6)
    doc.note("Receipts are settled fee payments; payments out are expense payments and fee refunds. Balances run from the "
             "opening balance on the first day of the period.")
    return doc.finish()


def _parse(value):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(422, "Use dates like 2026-11-02") from None


@router.get("")
def get_ledger(request: Request, user=Depends(current_user), period: str = Query(default="month", pattern="^(day|week|month|year)$"),
               start: str = Query(default=""), end: str = Query(default=""), mode: str = Query(default="all", pattern="^(all|cash)$"),
               entries_limit: int = Query(default=200, ge=0, le=2000)):
    data = request.app.state.store.snapshot()
    if not allowed(data, user):
        raise HTTPException(403, "Finance reports are not assigned to this role")
    result = ledger(data, period, _parse(start), _parse(end), mode)
    result["entries"] = result["entries"][-entries_limit:][::-1] if entries_limit else []
    return as_json(result)


@router.get("/pdf")
def get_ledger_pdf(request: Request, user=Depends(current_user), period: str = Query(default="month", pattern="^(day|week|month|year)$"),
                   start: str = Query(default=""), end: str = Query(default=""), mode: str = Query(default="all", pattern="^(all|cash)$")):
    data = request.app.state.store.snapshot()
    if not allowed(data, user):
        raise HTTPException(403, "Finance reports are not assigned to this role")
    raw = ledger_pdf(data, ledger(data, period, _parse(start), _parse(end), mode))
    return Response(raw, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{"cash" if mode == "cash" else "receipts"}-ledger-{period}.pdf"',
        "Cache-Control": "private, no-store"})
