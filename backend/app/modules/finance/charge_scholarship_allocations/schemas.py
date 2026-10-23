from app.core.resources import make_model

CreateRequest = make_model("charge_scholarship_allocations")
UpdateRequest = make_model("charge_scholarship_allocations", partial=True)
