from decimal import Decimal, InvalidOperation

from app.core.resources import ResourceService


class Service(ResourceService):
    """Student edits preserve file pointers and synchronize previous-education summaries."""

    def update(self, data, code, body, actor):
        education = body.get("previous_education")
        if "previous_education" in body and isinstance(education, dict):
            body = dict(body)
            body["previous_institution"] = education.get("institution") or None
            level = education.get("level")
            body["previous_qualification"] = ("10th class" if level == "ssc" else
                f"Intermediate {education.get('group') or ''}".strip() if level == "intermediate" else None)
            score = education.get("grade") if level == "ssc" else education.get("second_year_score") or education.get("first_year_score")
            try:
                score = Decimal(str(score))
                body["previous_score"] = str(score) if score.is_finite() and 0 <= score <= 100 else None
            except (InvalidOperation, ValueError):
                body["previous_score"] = None
        result = super().update(data, code, body, actor)
        if "previous_education" in body:
            for profile in data["records"].get("student_admission_profiles", {}).values():
                if profile.get("student_code") == code:
                    profile["last_qualification"] = education
        return result
