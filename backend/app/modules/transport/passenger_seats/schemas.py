from app.core.resources import make_model

CreateRequest = make_model("passenger_seats")
UpdateRequest = make_model("passenger_seats", partial=True)
