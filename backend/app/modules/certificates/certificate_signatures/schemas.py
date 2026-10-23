from app.core.resources import make_model

CreateRequest = make_model("certificate_signatures")
UpdateRequest = make_model("certificate_signatures", partial=True)
