from app.core.resources import make_model

CreateRequest = make_model("report_export_jobs")
UpdateRequest = make_model("report_export_jobs", partial=True)
