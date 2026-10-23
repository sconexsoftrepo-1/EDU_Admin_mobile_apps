from app.core.resources import make_model

CreateRequest = make_model("fee_heads")
UpdateRequest = make_model("fee_heads", partial=True)
