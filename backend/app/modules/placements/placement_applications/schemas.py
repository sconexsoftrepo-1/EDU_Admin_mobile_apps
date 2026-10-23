from app.core.resources import make_model

CreateRequest = make_model("placement_applications")
UpdateRequest = make_model("placement_applications", partial=True)
