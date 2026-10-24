from app.core.resources import make_model

CreateRequest = make_model("device_tokens")
UpdateRequest = make_model("device_tokens", partial=True)
