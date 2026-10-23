from app.core.resources import make_model

CreateRequest = make_model("transport_stops")
UpdateRequest = make_model("transport_stops", partial=True)
