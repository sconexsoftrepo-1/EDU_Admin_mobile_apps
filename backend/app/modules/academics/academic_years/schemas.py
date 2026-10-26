from app.core.resources import make_model


class CreateRequest(make_model("academic_years")):
    # Course-linked callers can let the service generate the name from course and dates.
    name: str | None = None


UpdateRequest = make_model("academic_years", partial=True)
