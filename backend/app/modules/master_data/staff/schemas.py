"""Request contract of staff onboarding (POST /master-data/staff-onboarding)."""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import Field

from app.core.security import StrictModel

StaffKind = Literal["teaching", "non_teaching", "labour"]


class Personal(StrictModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    gender: Literal["female", "male", "other", "prefer_not_to_say"] | None = None
    date_of_birth: date | None = None
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, min_length=7, max_length=20)
    address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=12)


class Job(StrictModel):
    designation: str = Field(min_length=2, max_length=120, description="Role, e.g. Lecturer, Accountant, Gardener")
    department: str | None = Field(default=None, max_length=120, description="Department name or code; created if new")
    join_date: date
    employment_type: Literal["permanent", "contract", "part_time", "daily_wage"] = "permanent"
    campus_code: str | None = None


class Qualification(StrictModel):
    level: Literal["graduation", "post_graduation", "doctorate", "diploma", "school", "other"]
    specialization: str | None = Field(default=None, max_length=200)


class Experience(StrictModel):
    organization: str = Field(min_length=2, max_length=200)
    role: str | None = Field(default=None, max_length=120)
    from_date: date | None = None
    to_date: date | None = None
    details: str | None = Field(default=None, max_length=1000)


class History(StrictModel):
    organization: str = Field(min_length=2, max_length=200)
    designation: str | None = Field(default=None, max_length=120)
    from_date: date | None = None
    to_date: date | None = None
    reason_for_leaving: str | None = Field(default=None, max_length=300)


class Achievement(StrictModel):
    title: str = Field(min_length=2, max_length=200)
    year: int | None = Field(default=None, ge=1950, le=2100)
    details: str | None = Field(default=None, max_length=500)


class Bank(StrictModel):
    account_holder: str = Field(min_length=2, max_length=150)
    account_number: str = Field(pattern=r"^[0-9]{6,34}$")
    bank_name: str = Field(min_length=2, max_length=150)
    ifsc: str = Field(pattern=r"^[A-Z]{4}0[A-Z0-9]{6}$", description="e.g. SBIN0001234")
    branch: str | None = Field(default=None, max_length=150)


class SalaryComponent(StrictModel):
    component: str = Field(min_length=1, max_length=120)
    component_type: Literal["earning", "deduction"]
    amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2, description="Monthly amount")


class Salary(StrictModel):
    """Teaching/non-teaching: monthly breakdown (earnings and deductions); labour: basis and amount."""

    basis: Literal["monthly", "yearly", "daily"] = "monthly"
    amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2,
                                   description="Labour: wage for the basis (per day, month or year)")
    components: list[SalaryComponent] = Field(default_factory=list, max_length=30)
    ctc_annual: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    in_hand_monthly: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)


class StaffOnboardingInput(StrictModel):
    kind: StaffKind
    personal: Personal
    job: Job
    qualification: Qualification | None = None
    certificates: list[str] = Field(default_factory=list, max_length=30, description="Qualification certificate names")
    aadhaar_number: str = Field(pattern=r"^[0-9]{12}$")
    pan_number: str | None = Field(default=None, pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]$")
    previous_experience: list[Experience] = Field(default_factory=list, max_length=20)
    employment_history: list[History] = Field(default_factory=list, max_length=20)
    achievements: list[Achievement] = Field(default_factory=list, max_length=30)
    bank: Bank
    salary: Salary
