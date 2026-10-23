from app.core.resources import make_model

CreateRequest = make_model("transport_attendance")
UpdateRequest = make_model("transport_attendance", partial=True)
