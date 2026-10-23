from app.core.resources import make_model

CreateRequest = make_model("student_enrollments")
UpdateRequest = make_model("student_enrollments", partial=True)
