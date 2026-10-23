from app.core.resources import make_model

CreateRequest = make_model("transport_allocations")
UpdateRequest = make_model("transport_allocations", partial=True)
