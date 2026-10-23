from app.core.resources import make_model

CreateRequest = make_model("purchase_requests")
UpdateRequest = make_model("purchase_requests", partial=True)
