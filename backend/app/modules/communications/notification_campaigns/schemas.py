from app.core.resources import make_model

CreateRequest = make_model("notification_campaigns")
UpdateRequest = make_model("notification_campaigns", partial=True)
