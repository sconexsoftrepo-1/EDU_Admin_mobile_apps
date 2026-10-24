from app.core.resources import make_model

CreateRequest = make_model("student_attendance")
UpdateRequest = make_model("student_attendance", partial=True)
