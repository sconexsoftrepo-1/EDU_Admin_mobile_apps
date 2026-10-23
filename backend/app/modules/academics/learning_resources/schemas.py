from app.core.resources import make_model

CreateRequest = make_model("learning_resources")
UpdateRequest = make_model("learning_resources", partial=True)
