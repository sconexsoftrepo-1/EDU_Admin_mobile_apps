from app.core.resources import make_model

CreateRequest = make_model("contact_enquiries")
UpdateRequest = make_model("contact_enquiries", partial=True)
