from app.core.resources import make_model

CreateRequest = make_model("hostel_allocations")
UpdateRequest = make_model("hostel_allocations", partial=True)
