from app.core.resources import make_model

CreateRequest = make_model("student_scholarships")
UpdateRequest = make_model("student_scholarships", partial=True)
