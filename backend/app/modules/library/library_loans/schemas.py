from app.core.resources import make_model

CreateRequest = make_model("library_loans")
UpdateRequest = make_model("library_loans", partial=True)
