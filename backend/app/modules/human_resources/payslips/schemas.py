from app.core.resources import make_model

CreateRequest = make_model("payslips")
UpdateRequest = make_model("payslips", partial=True)
