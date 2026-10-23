"""Request contracts for master data entry. Each nested object holds the fields of one table
(see GET /api/v1/manifest and the screen field lists); the table services validate them."""

from datetime import date

from pydantic import Field

from app.core.security import StrictModel


class ParentLink(StrictModel):
    parent_code: str | None = Field(default=None, description="Existing parent; omit to create `parent`")
    parent: dict | None = Field(default=None, description="New parent fields (parents table)")
    relationship: str = Field(description="father, mother, guardian or other")
    is_primary: bool = False
    can_pickup: bool = False
    receives_notifications: bool = True


class StudentEnrollmentInput(StrictModel):
    student: dict = Field(description="students table fields")
    parents: list[ParentLink] = Field(default_factory=list, max_length=6)


class ParentEnrollmentInput(StrictModel):
    parents: list[ParentLink] = Field(min_length=1, max_length=6)


class AdmissionFormInput(StrictModel):
    application: dict = Field(description="admission_applications fields")
    guardians: list[dict] = Field(default_factory=list, max_length=6)
    qualifications: list[dict] = Field(default_factory=list, max_length=10)


class TeachingStaffInput(StrictModel):
    employee: dict = Field(description="employees fields; employee_type is set to 'teacher'")
    teacher: dict = Field(description="teachers fields (qualification, specialization, ...)")


class PayComponent(StrictModel):
    component: str = Field(min_length=1, max_length=120)
    component_type: str = Field(pattern=r"^(earning|deduction)$")
    amount: str = Field(description="Monthly amount, e.g. '25000.00'")
    effective_from: date | None = None
    effective_to: date | None = None


class NonTeachingStaffInput(StrictModel):
    employee: dict = Field(description="employees fields; employee_type is set to 'staff'")
    staff_profile: dict = Field(description="staff_profiles fields (responsibility, shift)")
    salary_components: list[PayComponent] = Field(default_factory=list, max_length=30)


class CourseInput(StrictModel):
    program: dict = Field(description="programs fields")
    batches: list[dict] = Field(default_factory=list, max_length=10, description="year-based batches")


class BatchInput(StrictModel):
    batch: dict = Field(description="batches fields; program_code comes from the path")
    sections: list[dict] = Field(default_factory=list, max_length=20)


class EnrollmentLine(StrictModel):
    student_code: str
    roll_number: str


class CourseEnrollmentInput(StrictModel):
    section_code: str
    enrolled_on: date | None = None
    students: list[EnrollmentLine] = Field(min_length=1, max_length=300)


class ActionInput(StrictModel):
    values: dict = Field(default_factory=dict)
