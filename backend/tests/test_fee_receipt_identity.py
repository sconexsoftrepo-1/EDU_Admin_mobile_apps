"""Receipt stationery, fee-head titles and copy labels stay consistent in generated PDFs."""
import base64
import re
import zlib

from app.core.finance_pdfs import RECEIPT_COPIES, _receipt_title, fee_receipt_pdf
from app.core.pdf_kit import Document


def text_of(raw):
    """Read ReportLab text streams without adding a PDF parser dependency."""
    text = []
    for match in re.finditer(rb"(?<!end)stream\r?\n(.*?)endstream", raw, re.S):
        stream = match.group(1).strip()
        metadata = raw[max(0, match.start() - 400):match.start()]
        try:
            if b"ASCII85Decode" in metadata:
                stream = base64.a85decode(stream, adobe=True)
            if b"FlateDecode" in metadata:
                stream = zlib.decompress(stream)
        except (ValueError, zlib.error):
            continue
        text.extend(value.decode("latin1") for value in re.findall(rb"\(((?:\\.|[^\\)])*)\)\s*Tj", stream))
    return " ".join(text)


def sample():
    data = {"records": {
        "institutions": {"I": {"code": "I", "name": "Pragathi"}},
        "campuses": {"C": {"code": "C", "institution_code": "I", "name": "Main Campus"}},
    }}
    payment = {"code": "P", "amount": "13000", "method": "cash", "status": "settled", "paid_on": "2026-11-18",
               "fee_head_name": "Tuition fee", "payer": {"name": "Example Student", "course_branch": "BCA", "academic_year": "2026-27"}}
    receipt = {"code": "R", "receipt_number": "RCT-0001"}
    return data, receipt, payment


def test_receipt_header_has_official_identity_address_phone_and_actual_fee_head():
    data, receipt, payment = sample()
    text = text_of(fee_receipt_pdf(data, receipt, payment))
    for value in ("Pragathi", "Educational Institutions", "Kothavalasa-Vizianagaram Rd,",
                  "Ardhannapalem, Andhra Pradesh-535183", "+91 94403 19293", "TUITION FEE RECEIPT", "RCT-0001"):
        assert value in text
    assert "Main Campus" not in text
    assert "13,000.00" in text


def test_both_receipt_copies_repeat_branding_and_preserve_recipient_labels():
    data, receipt, payment = sample()
    text = text_of(fee_receipt_pdf(data, receipt, payment, RECEIPT_COPIES))
    assert text.count("Educational Institutions") == 2
    assert text.count("+91 94403 19293") == 2
    assert text.count("TUITION FEE RECEIPT") == 2
    assert "ADMIN / STAFF COPY" in text and "STUDENT COPY" in text


def test_long_head_is_wrapped_without_truncating_its_words():
    data, receipt, payment = sample()
    payment["fee_head_name"] = "Campus Development and Educational Infrastructure Maintenance Contribution"
    text = text_of(fee_receipt_pdf(data, receipt, payment))
    assert payment["fee_head_name"].upper() + " RECEIPT" in text


def test_legacy_allocations_and_head_codes_supply_receipt_title():
    data, _, _ = sample()
    data["records"]["fee_heads"] = {"H": {"name": "Transport fee"}}
    assert _receipt_title(data, {"fee_head_code": "H"}, {}) == "TRANSPORT FEE RECEIPT"
    data["records"]["payment_allocations"] = {
        "A": {"payment_code": "P", "charge_code": "C1"},
        "B": {"payment_code": "P", "charge_code": "C2"},
        "C": {"payment_code": "OTHER", "charge_code": "C3"},
    }
    charges = {"C1": {"fee_head": "Tuition fee"}, "C2": {"fee_head": "Transport fee"}, "C3": {"fee_head": "Other"}}
    assert _receipt_title(data, {"code": "P"}, charges) == "TUITION FEE + TRANSPORT FEE RECEIPT"
    assert _receipt_title({"records": {}}, {}, {}) == "FEE RECEIPT"


def test_other_documents_keep_their_existing_campus_header():
    data, _, _ = sample()
    text = text_of(Document(data, "PAYSLIP").finish())
    assert "Main Campus" in text
    assert "Educational Institutions" not in text
