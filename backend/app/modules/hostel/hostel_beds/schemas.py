from app.core.resources import make_model

CreateRequest = make_model("hostel_beds")
UpdateRequest = make_model("hostel_beds", partial=True)
