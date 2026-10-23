from app.core.resources import make_model

CreateRequest = make_model("departments")
UpdateRequest = make_model("departments", partial=True)
