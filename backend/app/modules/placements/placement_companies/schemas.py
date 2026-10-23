from app.core.resources import make_model

CreateRequest = make_model("placement_companies")
UpdateRequest = make_model("placement_companies", partial=True)
