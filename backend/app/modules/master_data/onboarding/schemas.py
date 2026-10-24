"""Request contracts for master data entry. Each nested object holds the fields of one table
(see GET /api/v1/manifest and the screen field lists); the table services validate them."""

from datetime import date
from decimal import Decimal

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


class CourseFeeLineInput(StrictModel):
    code: str | None = None
    fee_head_code: str | None = None
    name: str | None = Field(default=None, max_length=100)
    category: str = Field(default="academic", pattern=r"^(academic|hostel|transport|other)$")
    amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    due_date: date | None = None


class CourseFeeScheduleInput(StrictModel):
    fee_basis: str = Field(default="annual", pattern=r"^(annual|full_course)$")
    term_count: int = Field(default=4, ge=1, le=40)
    term_due_dates: list[date | None] = Field(default_factory=list, max_length=40)
    program_code: str
    academic_year_code: str
    year_of_study: int = Field(default=1, ge=1, le=20)
    installment_number: int = Field(default=1, ge=1)
    billing_frequency: str = Field(default="annual", pattern=r"^(one_time|annual|semester|term|monthly|per_use)$")
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")
    due_date: date
    lines: list[CourseFeeLineInput] = Field(min_length=1, max_length=40)
