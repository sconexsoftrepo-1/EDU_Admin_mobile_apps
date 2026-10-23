from app.core.resources import make_model

CreateRequest = make_model("assignments")
UpdateRequest = make_model("assignments", partial=True)
