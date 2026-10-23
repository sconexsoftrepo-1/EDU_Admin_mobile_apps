from app.core.resources import make_model

CreateRequest = make_model("teachers")
UpdateRequest = make_model("teachers", partial=True)
