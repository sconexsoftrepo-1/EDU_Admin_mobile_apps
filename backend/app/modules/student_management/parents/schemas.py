from app.core.resources import make_model

CreateRequest = make_model("parents")
UpdateRequest = make_model("parents", partial=True)
