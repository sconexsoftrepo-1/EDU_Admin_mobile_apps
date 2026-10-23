from app.core.resources import make_model

CreateRequest = make_model("fee_adjustments")
UpdateRequest = make_model("fee_adjustments", partial=True)
