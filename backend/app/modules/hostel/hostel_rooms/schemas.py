from app.core.resources import make_model

CreateRequest = make_model("hostel_rooms")
UpdateRequest = make_model("hostel_rooms", partial=True)
