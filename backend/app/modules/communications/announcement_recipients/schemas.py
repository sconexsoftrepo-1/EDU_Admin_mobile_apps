from app.core.resources import make_model

CreateRequest = make_model("announcement_recipients")
UpdateRequest = make_model("announcement_recipients", partial=True)
