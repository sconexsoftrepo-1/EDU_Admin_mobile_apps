from app.core.resources import make_model

CreateRequest = make_model("staff_profiles")
UpdateRequest = make_model("staff_profiles", partial=True)
