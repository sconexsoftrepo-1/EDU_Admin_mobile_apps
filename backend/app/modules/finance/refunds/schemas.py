from app.core.resources import make_model

CreateRequest = make_model("refunds")
UpdateRequest = make_model("refunds", partial=True)
