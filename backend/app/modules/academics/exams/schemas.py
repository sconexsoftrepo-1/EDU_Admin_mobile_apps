from app.core.resources import make_model

CreateRequest = make_model("exams")
UpdateRequest = make_model("exams", partial=True)
