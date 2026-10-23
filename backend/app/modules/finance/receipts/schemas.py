from app.core.resources import make_model

CreateRequest = make_model("receipts")
UpdateRequest = make_model("receipts", partial=True)
