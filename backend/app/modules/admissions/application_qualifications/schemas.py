from app.core.resources import make_model

CreateRequest = make_model("application_qualifications")
UpdateRequest = make_model("application_qualifications", partial=True)
