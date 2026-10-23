from app.core.resources import make_model

CreateRequest = make_model("admission_documents")
UpdateRequest = make_model("admission_documents", partial=True)
