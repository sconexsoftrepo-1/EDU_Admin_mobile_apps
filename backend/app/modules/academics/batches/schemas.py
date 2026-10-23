from app.core.resources import make_model

CreateRequest = make_model("batches")
UpdateRequest = make_model("batches", partial=True)
