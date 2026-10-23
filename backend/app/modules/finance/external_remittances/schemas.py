from app.core.resources import make_model

CreateRequest = make_model("external_remittances")
UpdateRequest = make_model("external_remittances", partial=True)
