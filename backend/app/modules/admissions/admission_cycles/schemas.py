from app.core.resources import make_model

CreateRequest = make_model("admission_cycles")
UpdateRequest = make_model("admission_cycles", partial=True)
