from app.core.resources import make_model

CreateRequest = make_model("refund_allocations")
UpdateRequest = make_model("refund_allocations", partial=True)
