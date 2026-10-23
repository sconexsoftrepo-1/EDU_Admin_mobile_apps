from app.core.resources import make_model

CreateRequest = make_model("sections")
UpdateRequest = make_model("sections", partial=True)
