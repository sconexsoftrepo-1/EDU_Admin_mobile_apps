from app.core.resources import make_model

CreateRequest = make_model("semesters")
UpdateRequest = make_model("semesters", partial=True)
