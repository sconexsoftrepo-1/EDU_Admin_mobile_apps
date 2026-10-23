from app.core.resources import make_model

CreateRequest = make_model("placement_drives")
UpdateRequest = make_model("placement_drives", partial=True)
