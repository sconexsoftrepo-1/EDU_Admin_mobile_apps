from app.core.resources import make_model

CreateRequest = make_model("library_books")
UpdateRequest = make_model("library_books", partial=True)
