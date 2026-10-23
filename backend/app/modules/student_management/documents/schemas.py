from app.core.resources import make_model

CreateRequest = make_model("documents")
UpdateRequest = make_model("documents", partial=True)
