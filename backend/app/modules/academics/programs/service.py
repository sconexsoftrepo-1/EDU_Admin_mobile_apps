from app.core.resources import ResourceService


class Service(ResourceService):
    """Business rules for programs. Data access is injected from api.py."""

    def delete(self, data, code, actor):
        from fastapi import HTTPException
        if any(year.get("program_code") == code for year in data["records"].get("academic_years", {}).values()):
            raise HTTPException(409, "Course is referenced by academic years")
        return super().delete(data, code, actor)
