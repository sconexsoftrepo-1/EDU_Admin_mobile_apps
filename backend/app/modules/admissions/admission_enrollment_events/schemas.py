from app.core.resources import make_model

CreateRequest = make_model("admission_enrollment_events")
UpdateRequest = make_model("admission_enrollment_events", partial=True)
