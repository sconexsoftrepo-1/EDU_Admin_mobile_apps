from app.core.resources import make_model

CreateRequest = make_model("timetable_swap_requests")
UpdateRequest = make_model("timetable_swap_requests", partial=True)
