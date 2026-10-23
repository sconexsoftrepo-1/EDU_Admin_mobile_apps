from app.core.resources import make_model

CreateRequest = make_model("students")
UpdateRequest = make_model("students", partial=True)
