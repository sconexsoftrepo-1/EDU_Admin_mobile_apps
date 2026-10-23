from app.core.resources import make_model

CreateRequest = make_model("vehicle_seats")
UpdateRequest = make_model("vehicle_seats", partial=True)
