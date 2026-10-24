"""Finance, HR and admission report queries and downloadable formats."""

import csv
import io
import json
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from openpyxl import Workbook

from app.core.security import current_user, has_permission
from app.core.storage import audit, now
from app.modules.documents.files.api import pdf
from app.modules.finance.transactions.api import calculate_ledger

router = APIRouter(prefix="/reports", tags=["Reports and exports"])


def query_rows(data, table):
    return list(data["records"].get(table, {}).values())


def cash_entries(data):
    entries = []
    for p in query_rows(data, "payments"):
        if p["status"] == "settled" and p["method"] == "cash":
            entries.append(
                {
                    "date": p["paid_on"],
                    "reference": p["code"],
                    "description": "Fee collection",
                    "receipt": p["amount"],
                    "payment": "0",
                }
            )
    for p in query_rows(data, "expense_payment_entries"):
        if p["method"] == "cash":
            entries.append(
                {
                    "date": p["paid_on"],
                    "reference": p["code"],
                    "description": "Expense payment",
                    "receipt": "0",
                    "payment": p["amount"],
                }
            )
    payments = {p["code"]: p for p in query_rows(data, "payments")}
    for p in query_rows(data, "refunds"):
        if payments.get(p["payment_code"], {}).get("method") == "cash":
            entries.append(
                {
                    "date": p["refunded_on"],
                    "reference": p["code"],
                    "description": "Fee refund",
                    "receipt": "0",
                    "payment": p["amount"],
                }
            )
    return sorted(entries, key=lambda r: (r["date"], r["reference"]))


def report(data, name, start, end):
    if name in {"finance", "outstanding"}:
        rows = [
            {
                "student_code": student["code"],
                "student": student["first_name"] + " " + student["last_name"],
                **calculate_ledger(data, student["code"])["totals"],
            }
            for student in query_rows(data, "students")
        ]
        if name == "outstanding":
            rows = [r for r in rows if Decimal(r["outstanding"]) > 0]
        return rows
    if name == "cashbook":
        rows = cash_entries(data)
        opening = sum(
            (
                Decimal(r["receipt"]) - Decimal(r["payment"])
                for r in rows
                if start and r["date"] < start
            ),
            Decimal("0"),
        )
        running = opening
        output = []
        for row in rows:
            if start and row["date"] < start or end and row["date"] > end:
                continue
            running += Decimal(row["receipt"]) - Decimal(row["payment"])
            output.append({**row, "balance": str(running)})
        return [
            {
                "date": start or "Opening",
                "reference": "OPENING",
                "description": "Opening balance",
                "receipt": "0",
                "payment": "0",
                "balance": str(opening),
            },
            *output,
        ]
    mapping = {
        "collections": ("payments", "paid_on"),
        "external_remittances": ("external_remittances", "paid_on"),
        "expenses": ("expenses", "expense_date"),
        "payroll": ("payslips", None),
        "admissions": ("admission_applications", "applied_on"),
    }
    if name not in mapping:
        raise HTTPException(404, "Unknown report")
    table, key = mapping[name]
    rows = query_rows(data, table)
    if key:
        rows = [
            r
            for r in rows
            if (not start or r.get(key, "") >= start)
            and (not end or r.get(key, "") <= end)
        ]
    return [
        {
            k: v
            for k, v in r.items()
            if k
            not in {
                "request",
                "idempotency_key",
                "storage_key",
                "address",
                "date_of_birth",
            }
        }
        for r in rows
    ]


@router.get("/{filename}")
def export(
    filename: str,
    request: Request,
    start: str | None = None,
    end: str | None = None,
    user=Depends(current_user),
):
    try:
        name, format = filename.rsplit(".", 1)
    except ValueError:
        raise HTTPException(422, "Specify .json, .csv, .xlsx or .pdf")
    if format not in {"json", "csv", "xlsx", "pdf"}:
        raise HTTPException(422, "Unsupported format")
    for value in [start, end]:
        if value:
            try:
                date.fromisoformat(value)
            except ValueError:
                raise HTTPException(422, "Use ISO dates")
    if start and end and start > end:
        raise HTTPException(422, "Invalid date range")
    data = request.app.state.store.snapshot()
    permission = "view" if format == "json" else "export"
    if user["person_type"] not in {"employee", "system"} or not has_permission(
        data, user, "reports", permission
    ):
        raise HTTPException(403, "Report permission denied")
    rows = report(data, name, start, end)
    if format == "json":
        return {"items": rows, "total": len(rows), "start": start, "end": end}
    columns = list(dict.fromkeys(k for r in rows for k in r)) or ["message"]

    def safe(value):
        text = (
            json.dumps(value)
            if isinstance(value, (dict, list))
            else str(value)
            if value is not None
            else ""
        )
        return "'" + text if text.startswith(("=", "+", "-", "@")) else text

    values = [[safe(row.get(k)) for k in columns] for row in rows]
    if format == "csv":
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(columns)
        writer.writerows(values)
        raw = buffer.getvalue().encode()
        mime = "text/csv"
    elif format == "xlsx":
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "College report"
        sheet.append(columns)
        for row in values:
            sheet.append(row)
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
        for column in sheet.columns:
            sheet.column_dimensions[column[0].column_letter].width = 25
        buffer = io.BytesIO()
        workbook.save(buffer)
        raw = buffer.getvalue()
        mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        raw = pdf(
            name.replace("_", " ").title() + " report",
            [
                "Generated: " + now(),
                "Reporting period: " + str(start or "All") + " to " + str(end or "All"),
                *[
                    " | ".join(f"{k}: {row.get(k, '')}" for k in columns)
                    for row in rows
                ],
            ],
        )
        mime = "application/pdf"
    with request.app.state.store.transaction() as data:
        audit(data, user["code"], "export", "reports", name)
    return Response(
        raw,
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
