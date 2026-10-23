from app.core.resources import make_model

CreateRequest = make_model("certificates")
UpdateRequest = make_model("certificates", partial=True)
