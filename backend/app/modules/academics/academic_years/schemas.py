from app.core.resources import make_model

CreateRequest = make_model("academic_years")
UpdateRequest = make_model("academic_years", partial=True)
