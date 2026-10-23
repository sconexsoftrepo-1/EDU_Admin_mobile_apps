from app.core.resources import make_model

CreateRequest = make_model("payments")
UpdateRequest = make_model("payments", partial=True)
