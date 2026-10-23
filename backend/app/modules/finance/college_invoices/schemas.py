from app.core.resources import make_model

CreateRequest = make_model("college_invoices")
UpdateRequest = make_model("college_invoices", partial=True)
