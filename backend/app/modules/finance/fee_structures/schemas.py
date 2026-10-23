from app.core.resources import make_model

CreateRequest = make_model("fee_structures")
UpdateRequest = make_model("fee_structures", partial=True)
