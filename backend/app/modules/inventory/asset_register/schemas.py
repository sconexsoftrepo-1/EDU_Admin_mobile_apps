from app.core.resources import make_model

CreateRequest = make_model("asset_register")
UpdateRequest = make_model("asset_register", partial=True)
