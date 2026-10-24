from app.core.resources import make_model

CreateRequest = make_model("library_copies")
UpdateRequest = make_model("library_copies", partial=True)
