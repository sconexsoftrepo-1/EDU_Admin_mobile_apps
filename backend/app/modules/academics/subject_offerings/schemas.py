from app.core.resources import make_model

CreateRequest = make_model("subject_offerings")
UpdateRequest = make_model("subject_offerings", partial=True)
