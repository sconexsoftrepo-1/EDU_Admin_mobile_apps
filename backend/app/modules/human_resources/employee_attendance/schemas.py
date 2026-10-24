from app.core.resources import make_model

CreateRequest = make_model("employee_attendance")
UpdateRequest = make_model("employee_attendance", partial=True)
