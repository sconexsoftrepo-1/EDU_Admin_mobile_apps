from app.core.resources import make_model

CreateRequest = make_model("admission_sources")
UpdateRequest = make_model("admission_sources", partial=True)
