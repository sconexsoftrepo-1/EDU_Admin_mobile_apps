from app.core.resources import make_model

CreateRequest = make_model("attendance_sessions")
UpdateRequest = make_model("attendance_sessions", partial=True)
