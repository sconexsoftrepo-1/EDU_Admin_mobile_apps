from app.core.resources import make_model

CreateRequest = make_model("calendar_events")
UpdateRequest = make_model("calendar_events", partial=True)
