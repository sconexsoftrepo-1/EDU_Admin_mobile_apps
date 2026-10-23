from app.core.resources import make_model

CreateRequest = make_model("payslip_lines")
UpdateRequest = make_model("payslip_lines", partial=True)
