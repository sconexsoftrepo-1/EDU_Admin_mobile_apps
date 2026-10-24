from app.core.resources import make_model

CreateRequest = make_model("hostels")
UpdateRequest = make_model("hostels", partial=True)
