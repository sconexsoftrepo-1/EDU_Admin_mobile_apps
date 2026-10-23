from app.core.resources import make_model

CreateRequest = make_model("admission_applications")
UpdateRequest = make_model("admission_applications", partial=True)
