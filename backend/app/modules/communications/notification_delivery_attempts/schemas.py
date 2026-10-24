from app.core.resources import make_model

CreateRequest = make_model("notification_delivery_attempts")
UpdateRequest = make_model("notification_delivery_attempts", partial=True)
