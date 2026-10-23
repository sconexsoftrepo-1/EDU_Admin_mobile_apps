from app.core.resources import make_model

CreateRequest = make_model("leave_types")
UpdateRequest = make_model("leave_types", partial=True)
