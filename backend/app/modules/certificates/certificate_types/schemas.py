from app.core.resources import make_model

CreateRequest = make_model("certificate_types")
UpdateRequest = make_model("certificate_types", partial=True)
