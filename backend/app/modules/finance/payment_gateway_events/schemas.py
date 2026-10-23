from app.core.resources import make_model

CreateRequest = make_model("payment_gateway_events")
UpdateRequest = make_model("payment_gateway_events", partial=True)
