from app.core.resources import make_model

CreateRequest = make_model("vendors")
UpdateRequest = make_model("vendors", partial=True)
