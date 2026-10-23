from app.core.resources import make_model

CreateRequest = make_model("transport_routes")
UpdateRequest = make_model("transport_routes", partial=True)
