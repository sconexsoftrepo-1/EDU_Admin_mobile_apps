from app.core.resources import make_model

CreateRequest = make_model("employees")
UpdateRequest = make_model("employees", partial=True)
