from app.core.resources import make_model

CreateRequest = make_model("vehicles")
UpdateRequest = make_model("vehicles", partial=True)
