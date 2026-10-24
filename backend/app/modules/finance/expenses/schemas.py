from app.core.resources import make_model

CreateRequest = make_model("expenses")
UpdateRequest = make_model("expenses", partial=True)
