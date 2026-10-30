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


def ensure_course_batch(data, year, actor):
    """Keep the calendar and cohort linked in the caller's transaction.

    Reuse historical cohort IDs so sections and enrolled students keep their links.
    The link is server-owned metadata, stored alongside the calendar in record_extras.
    """
    from app.modules.academics.batches.api import service as batches

    program_code = year.get("program_code")
    if not program_code:
        return None
    start = date.fromisoformat(str(year["start_date"])[:10]).year
    end = date.fromisoformat(str(year["end_date"])[:10]).year
    candidates = [b for b in data["records"].get("batches", {}).values()
                  if b["program_code"] == program_code]
    batch = next((b for b in candidates if b["code"] == year.get("batch_code")), None)
    if batch is None:
        matches = [b for b in candidates if int(b["entry_year"]) == start
                   and int(b["graduation_year"]) == end]
        if len(matches) > 1:
            raise HTTPException(409, "Multiple existing batches match these dates; resolve the duplicate records first")
        batch = matches[0] if matches else batches.create(data, {
            "code": year["code"], "program_code": program_code, "name": year["name"],
            "entry_year": start, "graduation_year": end,
        }, actor)
    if batch.get("academic_year_code") not in (None, year["code"]):
        raise HTTPException(409, "This batch is already linked to another dated batch record")
    batch = {**batch, "academic_year_code": year["code"]}
    batches.repo.save(data, batch)
    year["batch_code"] = batch["code"]
    return batch


class Service(ResourceService):
    """Course-linked years generate their identifiers; existing shared calendars remain valid."""

    def create(self, data, body, actor):
        if body.get("program_code"):
            program = data["records"].get("programs", {}).get(body["program_code"])
            if not program:
                raise HTTPException(422, "Select a registered course")
            code, name = course_year_identity(program, body.get("start_date"), body.get("end_date"))
            body = {**body, "code": code, "name": name}
        record = super().create(data, body, actor)
        ensure_course_batch(data, record, actor)
        return self.repo.save(data, record)

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
        record = super().update(data, code, body, actor)
        ensure_course_batch(data, record, actor)
        if "start_date" in body or "end_date" in body:
            record["dates_need_review"] = False
        return self.repo.save(data, record)

    def delete(self, data, code, actor):
        year = self.repo.get(data, code)
        batch_code = year.get("batch_code")
        # Both deletes share the surrounding transaction: referenced batches are retained.
        if batch_code:
            from app.modules.academics.batches.api import service as batches
            batches.delete(data, batch_code, actor)
        return super().delete(data, code, actor)
