from app.core.resources import make_model

CreateRequest = make_model("payroll_adjustments")
UpdateRequest = make_model("payroll_adjustments", partial=True)
