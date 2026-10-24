from app.core.resources import make_model

CreateRequest = make_model("vehicle_trips")
UpdateRequest = make_model("vehicle_trips", partial=True)
