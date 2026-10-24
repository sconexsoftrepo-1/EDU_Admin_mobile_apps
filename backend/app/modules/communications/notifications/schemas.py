from app.core.resources import make_model

CreateRequest = make_model("notifications")
UpdateRequest = make_model("notifications", partial=True)
