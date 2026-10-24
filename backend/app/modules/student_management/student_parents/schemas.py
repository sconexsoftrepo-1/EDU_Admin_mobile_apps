from app.core.resources import make_model

CreateRequest = make_model("student_parents")
UpdateRequest = make_model("student_parents", partial=True)
