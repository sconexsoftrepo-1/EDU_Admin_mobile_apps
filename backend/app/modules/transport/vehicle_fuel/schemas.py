from app.core.resources import make_model

CreateRequest = make_model("vehicle_fuel")
UpdateRequest = make_model("vehicle_fuel", partial=True)
