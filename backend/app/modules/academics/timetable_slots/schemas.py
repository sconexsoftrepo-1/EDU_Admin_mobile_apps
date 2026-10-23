from app.core.resources import make_model

CreateRequest = make_model("timetable_slots")
UpdateRequest = make_model("timetable_slots", partial=True)
