from app.core.resources import ResourceService


class Service(ResourceService):
    """Business rules for programs. Data access is injected from api.py."""

    def create(self, data, body, actor):
        from app.core.course_form import normalize
        return super().create(data, normalize(data, body), actor)

    def update(self, data, code, body, actor):
        from app.core.course_form import normalize
        from fastapi import HTTPException
        if "subject_entries" in body:
            raise HTTPException(422, "Manage course subjects in the semester workspace")
        old = self.repo.get(data, code)
        body = normalize(data, body, old)
        # Subjects already have their own revision-controlled management screen.
        # Never overwrite that curriculum from a course-details edit.
        return super().update(data, code, body, actor)

    def delete(self, data, code, actor):
        from fastapi import HTTPException
        if any(year.get("program_code") == code for year in data["records"].get("academic_years", {}).values()):
            raise HTTPException(409, "Course is referenced by academic years")
        return super().delete(data, code, actor)
