from app.core.resources import make_model

CreateRequest = make_model("inventory_items")
UpdateRequest = make_model("inventory_items", partial=True)
