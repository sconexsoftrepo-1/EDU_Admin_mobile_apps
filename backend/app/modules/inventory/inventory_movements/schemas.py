from app.core.resources import make_model

CreateRequest = make_model("inventory_movements")
UpdateRequest = make_model("inventory_movements", partial=True)
