from app.core.resources import make_model

CreateRequest = make_model("grievances")
UpdateRequest = make_model("grievances", partial=True)
