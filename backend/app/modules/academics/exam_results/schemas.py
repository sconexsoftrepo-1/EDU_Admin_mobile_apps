from app.core.resources import make_model

CreateRequest = make_model("exam_results")
UpdateRequest = make_model("exam_results", partial=True)
