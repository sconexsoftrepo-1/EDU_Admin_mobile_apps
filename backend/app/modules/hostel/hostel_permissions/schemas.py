from app.core.resources import make_model

CreateRequest = make_model("hostel_permissions")
UpdateRequest = make_model("hostel_permissions", partial=True)
