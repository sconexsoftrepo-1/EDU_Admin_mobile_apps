from app.core.payroll_workspace import inr, words
from tests.test_screen_workflows import mobile_login


def payroll(app):
    with app.state.store.transaction() as d:
        r = d["records"]
        r.setdefault("institutions", {})["I"] = {"code": "I", "name": "Pragathi College"}
        r.setdefault("campuses", {})["C"] = {"code": "C", "institution_code": "I", "name": "Main campus", "city": "Hyderabad"}
        r.setdefault("employees", {})["E9"] = {"code": "E9", "campus_code": "C", "first_name": "Meera", "last_name": "Rao",
                                               "employee_type": "teacher", "designation": "Lecturer", "status": "active",
                                               "join_date": "2024-06-01"}
        r.setdefault("employee_salary_components", {}).update({
            "SC1": {"code": "SC1", "employee_code": "E9", "component": "Basic pay", "component_type": "earning", "amount": "40000"},
            "SC2": {"code": "SC2", "employee_code": "E9", "component": "HRA", "component_type": "earning", "amount": "12000"},
            "SC3": {"code": "SC3", "employee_code": "E9", "component": "Provident fund", "component_type": "deduction", "amount": "4800"},
        })
        r.setdefault("payroll_runs", {})["RUN10"] = {"code": "RUN10", "campus_code": "C", "period_start": "2026-10-01",
                                                     "period_end": "2026-10-31", "status": "published"}
        r.setdefault("payslips", {})["PS10"] = {"code": "PS10", "payroll_run_code": "RUN10", "employee_code": "E9",
                                                "gross_amount": "52000", "deduction_amount": "4800", "net_amount": "47200"}
        r.setdefault("payslip_lines", {}).update({
            "PL1": {"code": "PL1", "payslip_code": "PS10", "component": "Basic pay", "component_type": "earning", "amount": "40000"},
            "PL2": {"code": "PL2", "payslip_code": "PS10", "component": "HRA", "component_type": "earning", "amount": "12000"},
            "PL3": {"code": "PL3", "payslip_code": "PS10", "component": "Provident fund", "component_type": "deduction", "amount": "4800"},
        })


def test_amount_formatting():
    assert inr("1234567.5") == "12,34,567.50"
    assert words("47200") == "Forty-seven thousand two hundred rupees only"
    assert words("150000.25") == "One lakh fifty thousand rupees and twenty-five paise only"


def test_salary_structure_payslips_and_pdf(app, client, headers):
    payroll(app)
    listing = client.get("/api/v1/hr/salary-workspace", headers=headers).json()
    assert listing["can_manage"] and any(e["code"] == "E9" and e["payslips"] == 1 for e in listing["items"])
    detail = client.get("/api/v1/hr/salary-workspace/E9", headers=headers).json()
    structure = detail["structure"]
    assert structure["gross_monthly"] == "52000.00" and structure["net_monthly"] == "47200.00"
    assert [e["component"] for e in structure["earnings"]] == ["Basic pay", "HRA"]
    slip = detail["payslips"][0]
    assert slip["period"] == "October 2026" and slip["net_in_words"].startswith("Forty-seven thousand")

    pdf = client.get("/api/v1/documents/payslip/PS10/download", headers=headers)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert b"Payslip October 2026" in pdf.content  # document title

    # The staff app shows the same structure with the payslips; staff see only their own.
    staff = mobile_login(client, app, "teacher", "E9", "teacher-mobile")
    mobile = client.get("/api/v1/mobile/workspace/payslips", headers=staff).json()
    assert mobile["summary"]["structure"]["net_monthly"] == "47200.00"
    assert mobile["items"][0]["period"] == "October 2026" and mobile["items"][0]["earnings"]
    assert client.get("/api/v1/hr/salary-workspace/E1", headers=staff).status_code == 404
