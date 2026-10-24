from app.core.resources import make_model

CreateRequest = make_model("report_download_events")
UpdateRequest = make_model("report_download_events", partial=True)
