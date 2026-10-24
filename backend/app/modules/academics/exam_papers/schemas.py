from app.core.resources import make_model

CreateRequest = make_model("exam_papers")
UpdateRequest = make_model("exam_papers", partial=True)
