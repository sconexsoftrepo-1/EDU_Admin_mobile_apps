from app.core.resources import make_model

CreateRequest = make_model("student_fee_charges")
UpdateRequest = make_model("student_fee_charges", partial=True)
