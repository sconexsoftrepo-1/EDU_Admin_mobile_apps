from app.core.resources import make_model

CreateRequest = make_model("import_jobs")
UpdateRequest = make_model("import_jobs", partial=True)
