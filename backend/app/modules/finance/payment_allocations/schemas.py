from app.core.resources import make_model

CreateRequest = make_model("payment_allocations")
UpdateRequest = make_model("payment_allocations", partial=True)
