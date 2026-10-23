from app.core.resources import make_model

CreateRequest = make_model("admin_mobile_preferences")
UpdateRequest = make_model("admin_mobile_preferences", partial=True)
