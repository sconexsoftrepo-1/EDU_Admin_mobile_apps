from app.core.resources import ResourceService


class Service(ResourceService):
    """Business rules for programs. Data access is injected from api.py."""

    def create(self, data, body, actor):
        from app.core.course_form import normalize
        from app.core.admission_numbers import COURSE_CODES, branch_code
        from fastapi import HTTPException

        body = normalize(data, body)
        if not body.get("code") and body.get("course_level") in COURSE_CODES and body.get("branch_code"):
            body["branch_code"] = branch_code(body)
            body["code"] = f"{COURSE_CODES[body['course_level']]}-{body['branch_code']}"
            if body["code"] in data["records"].get("programs", {}):
                raise HTTPException(409, f"Course code {body['code']} already exists; choose a unique branch code")
        return super().create(data, body, actor)

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
