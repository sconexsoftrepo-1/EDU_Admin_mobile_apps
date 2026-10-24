from app.core.resources import make_model

CreateRequest = make_model("announcements")
UpdateRequest = make_model("announcements", partial=True)
