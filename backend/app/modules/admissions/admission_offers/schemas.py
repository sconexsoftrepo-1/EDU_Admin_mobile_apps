from app.core.resources import make_model

CreateRequest = make_model("admission_offers")
UpdateRequest = make_model("admission_offers", partial=True)
