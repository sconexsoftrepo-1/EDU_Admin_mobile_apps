from app.core.resources import make_model

CreateRequest = make_model("admission_enquiries")
UpdateRequest = make_model("admission_enquiries", partial=True)
