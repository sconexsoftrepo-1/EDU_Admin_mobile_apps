from app.core.resources import make_model

CreateRequest = make_model("employee_salary_components")
UpdateRequest = make_model("employee_salary_components", partial=True)
