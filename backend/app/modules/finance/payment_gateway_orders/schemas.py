from app.core.resources import make_model

CreateRequest = make_model("payment_gateway_orders")
UpdateRequest = make_model("payment_gateway_orders", partial=True)
