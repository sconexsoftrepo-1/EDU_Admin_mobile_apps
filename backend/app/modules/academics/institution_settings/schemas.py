from app.core.resources import make_model

CreateRequest = make_model("institution_settings")
UpdateRequest = make_model("institution_settings", partial=True)
