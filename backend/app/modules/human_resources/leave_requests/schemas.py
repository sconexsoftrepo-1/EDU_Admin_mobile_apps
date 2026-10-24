from app.core.resources import make_model

CreateRequest = make_model("leave_requests")
UpdateRequest = make_model("leave_requests", partial=True)
