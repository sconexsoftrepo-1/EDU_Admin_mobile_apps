from app.core.resources import make_model

CreateRequest = make_model("curriculum_subjects")
UpdateRequest = make_model("curriculum_subjects", partial=True)
