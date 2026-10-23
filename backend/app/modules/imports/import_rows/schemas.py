from app.core.resources import make_model

CreateRequest = make_model("import_rows")
UpdateRequest = make_model("import_rows", partial=True)
