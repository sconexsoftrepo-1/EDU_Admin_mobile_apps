from app.core.resources import make_model

CreateRequest = make_model("admission_reviews")
UpdateRequest = make_model("admission_reviews", partial=True)
