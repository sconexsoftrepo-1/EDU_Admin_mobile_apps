from app.core.resources import make_model

CreateRequest = make_model("thread_members")
UpdateRequest = make_model("thread_members", partial=True)
