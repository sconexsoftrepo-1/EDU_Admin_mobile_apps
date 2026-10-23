from app.core.resources import make_model

CreateRequest = make_model("fee_reminder_jobs")
UpdateRequest = make_model("fee_reminder_jobs", partial=True)
