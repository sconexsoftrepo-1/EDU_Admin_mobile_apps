from app.core.resources import make_model

CreateRequest = make_model("student_document_links")
UpdateRequest = make_model("student_document_links", partial=True)
