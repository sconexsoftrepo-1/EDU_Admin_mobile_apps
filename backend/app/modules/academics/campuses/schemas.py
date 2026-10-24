from app.core.resources import make_model

CreateRequest = make_model("campuses")
UpdateRequest = make_model("campuses", partial=True)
