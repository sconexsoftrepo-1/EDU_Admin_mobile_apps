from app.core.resources import make_model

CreateRequest = make_model("messages")
UpdateRequest = make_model("messages", partial=True)
