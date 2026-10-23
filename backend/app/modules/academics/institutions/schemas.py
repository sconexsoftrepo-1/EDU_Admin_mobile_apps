from app.core.resources import make_model

CreateRequest = make_model("institutions")
UpdateRequest = make_model("institutions", partial=True)
