from app.core.resources import make_model

CreateRequest = make_model("certificate_requests")
UpdateRequest = make_model("certificate_requests", partial=True)
