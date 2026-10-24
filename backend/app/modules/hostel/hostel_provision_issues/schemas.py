from app.core.resources import make_model

CreateRequest = make_model("hostel_provision_issues")
UpdateRequest = make_model("hostel_provision_issues", partial=True)
