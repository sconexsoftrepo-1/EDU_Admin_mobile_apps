from app.core.resources import make_model

CreateRequest = make_model("admission_status_history")
UpdateRequest = make_model("admission_status_history", partial=True)
