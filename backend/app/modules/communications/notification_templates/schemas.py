from app.core.resources import make_model

CreateRequest = make_model("notification_templates")
UpdateRequest = make_model("notification_templates", partial=True)
