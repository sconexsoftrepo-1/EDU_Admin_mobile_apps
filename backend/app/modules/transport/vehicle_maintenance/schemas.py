from app.core.resources import make_model

CreateRequest = make_model("vehicle_maintenance")
UpdateRequest = make_model("vehicle_maintenance", partial=True)
