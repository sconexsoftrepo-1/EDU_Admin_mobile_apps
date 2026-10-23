from app.core.resources import make_model

CreateRequest = make_model("purchase_orders")
UpdateRequest = make_model("purchase_orders", partial=True)
