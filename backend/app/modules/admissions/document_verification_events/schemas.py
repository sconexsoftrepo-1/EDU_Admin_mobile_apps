from app.core.resources import make_model

CreateRequest = make_model("document_verification_events")
UpdateRequest = make_model("document_verification_events", partial=True)
