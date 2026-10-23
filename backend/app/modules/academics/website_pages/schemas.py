from app.core.resources import make_model

CreateRequest = make_model("website_pages")
UpdateRequest = make_model("website_pages", partial=True)
