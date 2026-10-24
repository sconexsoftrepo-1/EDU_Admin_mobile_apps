from app.core.resources import make_model

CreateRequest = make_model("application_guardians")
UpdateRequest = make_model("application_guardians", partial=True)
