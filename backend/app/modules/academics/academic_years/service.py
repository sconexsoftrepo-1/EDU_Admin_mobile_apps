from datetime import date

from fastapi import HTTPException

from app.core.resources import ResourceService


def course_year_identity(program, start_date, end_date):
    try:
        start = date.fromisoformat(str(start_date))
        end = date.fromisoformat(str(end_date))
    except (ValueError, TypeError):
        raise HTTPException(422, "Enter valid academic year start and end dates") from None
    if end <= start:
        raise HTTPException(422, "Academic year end date must be after the start date")
    code = f"{program['code']}-{start.year:04d}-{end.year:04d}"
    if len(code) > 100:
        raise HTTPException(422, "The course code is too long to generate an academic year code")
    return code, f"{program['code']} {start.year:04d}–{end.year:04d}"


class Service(ResourceService):
    """Course-linked years generate their identifiers; existing shared calendars remain valid."""

    def create(self, data, body, actor):
        if body.get("program_code"):
            program = data["records"].get("programs", {}).get(body["program_code"])
            if not program:
                raise HTTPException(422, "Select a registered course")
            code, name = course_year_identity(program, body.get("start_date"), body.get("end_date"))
            body = {**body, "code": code, "name": name}
        return super().create(data, body, actor)

    def update(self, data, code, body, actor):
        current = self.repo.get(data, code)
        program_code = body.get("program_code", current.get("program_code"))
        if current.get("program_code") and program_code != current["program_code"]:
            raise HTTPException(409, "An academic year's course cannot be changed; create a new academic year")
        if program_code:
            program = data["records"].get("programs", {}).get(program_code)
            if not program:
                raise HTTPException(422, "Select a registered course")
            expected, name = course_year_identity(program, body.get("start_date", current["start_date"]), body.get("end_date", current["end_date"]))
            if expected != code:
                raise HTTPException(409, "Changing the year range would change the academic year code; create a new academic year instead")
            body = {**body, "name": name}
        return super().update(data, code, body, actor)
