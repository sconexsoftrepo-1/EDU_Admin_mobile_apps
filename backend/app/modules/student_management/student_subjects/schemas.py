from app.core.resources import make_model

CreateRequest = make_model("student_subjects")
UpdateRequest = make_model("student_subjects", partial=True)
