from app.core.resources import make_model

CreateRequest = make_model("message_threads")
UpdateRequest = make_model("message_threads", partial=True)
