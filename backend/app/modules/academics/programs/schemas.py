from app.core.resources import make_model

CreateRequest = make_model("programs")
UpdateRequest = make_model("programs", partial=True)
