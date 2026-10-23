from app.core.resources import make_model

CreateRequest = make_model("assignment_submissions")
UpdateRequest = make_model("assignment_submissions", partial=True)
