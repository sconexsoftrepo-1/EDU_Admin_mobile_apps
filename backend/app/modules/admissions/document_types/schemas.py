from app.core.resources import make_model

CreateRequest = make_model("document_types")
UpdateRequest = make_model("document_types", partial=True)
