from app.core.resources import make_model

CreateRequest = make_model("consents")
UpdateRequest = make_model("consents", partial=True)
