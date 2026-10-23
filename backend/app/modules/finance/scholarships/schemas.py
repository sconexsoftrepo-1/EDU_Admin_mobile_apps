from app.core.resources import make_model

CreateRequest = make_model("scholarships")
UpdateRequest = make_model("scholarships", partial=True)
