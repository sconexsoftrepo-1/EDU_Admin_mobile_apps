from app.core.resources import make_model

CreateRequest = make_model("external_parties")
UpdateRequest = make_model("external_parties", partial=True)
