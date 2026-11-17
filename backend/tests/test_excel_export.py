"""On-screen tables as a branded Excel workbook."""
import io

from openpyxl import load_workbook

BODY = {"title": "Non-teaching staff directory", "subtitle": "All departments", "filename": "non-teaching-staff",
        "columns": ["Name", "Designation", "Status", "Net pay / month"],
        "rows": [["Ravi Kumar", "Lab in-charge", "Active", "₹ 25,000.00"],
                 ["Sita Devi", "Clerk", "Active", "₹ 18,500.50"],
                 ["Arun", "Driver", "On leave", "15000"]]}


def test_table_downloads_as_a_branded_xlsx(client, headers):
    r = client.post("/api/v1/print/table.xlsx", headers=headers, json=BODY)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("application/vnd.openxmlformats")
    assert 'filename="non-teaching-staff.xlsx"' in r.headers["content-disposition"]
    wb = load_workbook(io.BytesIO(r.content))
    ws = wb.worksheets[0]
    texts = [str(c.value) for row in ws.iter_rows(max_row=6) for c in row if c.value]
    assert "Non-teaching staff directory" in texts and any("3 records" in t for t in texts)
    header = [c.value for c in ws[7]][:4]
    assert header == BODY["columns"]
    assert ws.cell(8, 4).value == 25000.0 and ws.cell(9, 4).value == 18500.5
    assert ws.cell(11, 1).value == "Grand total" and str(ws.cell(11, 4).value).startswith("=SUBTOTAL(9,D8:D10)")
    assert ws.auto_filter.ref and ws.freeze_panes == "A8"
    summary = wb["Summary"]
    cells = [c.value for row in summary.iter_rows() for c in row if c.value is not None]
    assert "Records" in cells and 3 in cells and "By Status" in cells and "Active" in cells


def test_only_staff_can_export(client, app):
    from tests.test_screen_workflows import mobile_login  # noqa: F401  (keeps fixtures import order)
    r = client.post("/api/v1/print/table.xlsx", json=BODY)
    assert r.status_code == 401
