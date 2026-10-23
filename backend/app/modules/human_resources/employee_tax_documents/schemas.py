from app.core.resources import make_model

CreateRequest = make_model("employee_tax_documents")
UpdateRequest = make_model("employee_tax_documents", partial=True)
