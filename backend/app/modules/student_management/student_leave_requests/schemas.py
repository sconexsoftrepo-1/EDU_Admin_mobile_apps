from app.core.resources import make_model

CreateRequest = make_model("student_leave_requests")
UpdateRequest = make_model("student_leave_requests", partial=True)
