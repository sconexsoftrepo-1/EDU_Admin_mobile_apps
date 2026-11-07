"""Request contract of the student enrollment wizard (POST /master-data/enrollment)."""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import Field, model_validator

from app.core.security import StrictModel

from ..staff.schemas import Bank

# Documents the wizard offers as a checklist; files may be uploaded now or later.
DOCUMENTS = {
    "transfer_certificate": "TC (transfer certificate)",
    "study_conduct_certificate": "Study & conduct certificate",
    "certificate_copy": "Certificate copy",
    "original_certificate": "Original certificate",
}
# Uploaded with every enrollment: Aadhaar copy is mandatory, the photo optional.
IDENTITY_DOCUMENTS = {"aadhaar_copy": "Aadhaar copy", "student_photo": "Student photo"}


class StudentDetails(StrictModel):
    complete_name: str | None = Field(default=None, min_length=1, max_length=300, description="Complete name as per SSC")
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    middle_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    date_of_birth: date
    gender: Literal["female", "male", "other", "prefer_not_to_say"]
    email: str | None = Field(default=None, max_length=254)
    phone: str = Field(min_length=7, max_length=20, description="Student contact number")
    aadhaar_number: str = Field(pattern=r"^[0-9]{12}$")
    blood_group: str | None = None
    nationality: str | None = Field(default="Indian", max_length=60)
    address: str = Field(min_length=3, max_length=500)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=100)
    postal_code: str = Field(min_length=4, max_length=12)
    country: str = Field(default="India", max_length=60)
    campus_code: str | None = None

    @model_validator(mode="after")
    def names(self):
        """The rest of the application uses name parts, so the complete name is split into them."""
        if self.complete_name:
            parts = self.complete_name.split()
            if not parts or len(parts[0]) > 100 or len(parts[-1]) > 100:
                raise ValueError("Enter the complete name as per SSC")
            self.first_name = parts[0]
            self.middle_name = " ".join(parts[1:-1])[:100] or None
            self.last_name = parts[-1]
        elif not (self.first_name and self.last_name):
            raise ValueError("Enter the complete name as per SSC")
        return self


class SemesterScore(StrictModel):
    semester: str = Field(min_length=1, max_length=30)
    score: str = Field(min_length=1, max_length=20, description="Percentage or grade")


class LastQualification(StrictModel):
    """One qualification: 10th class, Intermediate, Polytechnic, a degree (UG, PG, B.P.Ed, M.P.Ed) or another course."""

    level: Literal["ssc", "intermediate", "polytechnic", "degree", "pg", "bped", "mped", "other"]
    institution: str = Field(min_length=2, max_length=200, description="School or college name")
    board: str | None = Field(default=None, max_length=60, description="SSC, CBSE, ICSE, State board, ...")
    group: str | None = Field(default=None, max_length=30, description="Intermediate group: MPC, BPC, MEC, CEC, ...")
    grade: str | None = Field(default=None, max_length=20, description="10th grade / GPA / percentage")
    first_year_score: str | None = Field(default=None, max_length=20, description="Intermediate 1st year % or grade")
    second_year_score: str | None = Field(default=None, max_length=20, description="Intermediate 2nd year % or grade")
    passed_year: int | None = Field(default=None, ge=1990, le=2100)
    semester_scores: list[SemesterScore] = Field(default_factory=list, max_length=16)
    total_percentage: str | None = Field(default=None, max_length=20)


class FamilyDetails(StrictModel):
    father_name: str | None = Field(default=None, max_length=200, description="As per SSC")
    mother_name: str | None = Field(default=None, max_length=200, description="As per SSC")
    guardian_name: str | None = Field(default=None, max_length=200, description="As per SSC")
    guardian_relationship: str | None = Field(default=None, max_length=100)


class IdentityDetails(StrictModel):
    sachivalayam_code: str | None = Field(default=None, max_length=50)
    sachivalayam_name: str | None = Field(default=None, max_length=150)
    apar_id: str | None = Field(default=None, max_length=50, description="DigiLocker or APAR ID")


class BankAccounts(StrictModel):
    student: Bank | None = None
    mother: Bank | None = None


class GuardianDetails(StrictModel):
    """The student's guardian; the guardian's mobile number is the primary contact."""

    relationship: Literal["father", "mother", "guardian", "other"]
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=7, max_length=20, description="Guardian mobile number (primary contact)")
    alternate_phone: str | None = Field(default=None, max_length=20, description="Secondary number")


class Referral(StrictModel):
    name: str = Field(min_length=2, max_length=150)
    relation: str = Field(min_length=2, max_length=100, description="Relation to the organization")
    mobile: str = Field(min_length=7, max_length=20)


class Achievement(StrictModel):
    title: str = Field(min_length=2, max_length=200)
    level: str | None = Field(default=None, max_length=60, description="School, district, state, national, ...")
    year: int | None = Field(default=None, ge=1990, le=2100)
    description: str | None = Field(default=None, max_length=500)


class Certification(StrictModel):
    name: str = Field(min_length=2, max_length=200, description="e.g. NCC 'A' certificate, NSS, sports")
    issuer: str | None = Field(default=None, max_length=150)
    year: int | None = Field(default=None, ge=1990, le=2100)


class CourseChoice(StrictModel):
    course_level: Literal["intermediate", "degree", "polytechnic", "bped", "mped"]
    program_code: str
    academic_year_code: str
    batch_code: str | None = None
    section_code: str | None = None


class Concession(StrictModel):
    amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    name: str | None = Field(default=None, max_length=150, description="Scholarship name / sponsor")
    reason: str | None = Field(default=None, max_length=500)


class EnrollmentInput(StrictModel):
    student: StudentDetails
    admission_number: str | None = Field(default=None, pattern=r"^[A-Za-z0-9][A-Za-z0-9/_-]{0,39}$",
                                         description="Entered by staff; the generated number becomes the reference number")
    qualifications: list[LastQualification] = Field(default_factory=list, max_length=10)
    last_qualification: LastQualification | None = None
    family: FamilyDetails | None = None
    identity: IdentityDetails | None = None
    bank_accounts: BankAccounts | None = None
    guardian: GuardianDetails
    documents: dict[str, bool] = Field(default_factory=dict, description="Checklist of documents submitted")
    referral: Referral | None = None
    achievements: list[Achievement] = Field(default_factory=list, max_length=20)
    certifications: list[Certification] = Field(default_factory=list, max_length=20)
    course: CourseChoice
    hostel_required: bool = False
    transport_required: bool = False
    scholarship: Concession | None = None
    special_consideration: Concession | None = None

    @model_validator(mode="after")
    def latest_qualification(self):
        """The most recently added qualification also fills the student's previous-education fields."""
        if not self.last_qualification and self.qualifications:
            self.last_qualification = self.qualifications[-1]
        if not self.last_qualification:
            raise ValueError("Add at least one qualification")
        return self


class BatchSectionRename(StrictModel):
    code: str
    name: str = Field(min_length=1, max_length=200)


class BatchEditInput(StrictModel):
    entry_year: int = Field(ge=1000, le=9998)
    graduation_year: int = Field(ge=1001, le=9999)
    sections: list[BatchSectionRename] = Field(default_factory=list, max_length=300)
