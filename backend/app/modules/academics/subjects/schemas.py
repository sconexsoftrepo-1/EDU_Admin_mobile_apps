from app.core.resources import make_model

CreateRequest = make_model("subjects")
UpdateRequest = make_model("subjects", partial=True)
