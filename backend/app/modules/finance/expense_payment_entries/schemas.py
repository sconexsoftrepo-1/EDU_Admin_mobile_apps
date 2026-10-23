from app.core.resources import make_model

CreateRequest = make_model("expense_payment_entries")
UpdateRequest = make_model("expense_payment_entries", partial=True)
