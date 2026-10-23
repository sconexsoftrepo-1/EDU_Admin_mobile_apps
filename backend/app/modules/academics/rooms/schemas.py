from app.core.resources import make_model

CreateRequest = make_model("rooms")
UpdateRequest = make_model("rooms", partial=True)
