from app.core.resources import make_model

CreateRequest = make_model("enquiry_followups")
UpdateRequest = make_model("enquiry_followups", partial=True)
