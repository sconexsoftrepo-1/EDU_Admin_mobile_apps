from app.core.resources import make_model

CreateRequest = make_model("payroll_runs")
UpdateRequest = make_model("payroll_runs", partial=True)
