from app.core.resources import make_model

CreateRequest = make_model("student_status_history")
UpdateRequest = make_model("student_status_history", partial=True)
