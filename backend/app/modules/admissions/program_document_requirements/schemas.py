from app.core.resources import make_model

CreateRequest = make_model("program_document_requirements")
UpdateRequest = make_model("program_document_requirements", partial=True)
