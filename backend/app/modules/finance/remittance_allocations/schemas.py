from app.core.resources import make_model

CreateRequest = make_model("remittance_allocations")
UpdateRequest = make_model("remittance_allocations", partial=True)
