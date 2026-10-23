from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import Field, field_validator

from app.core.security import StrictModel


class PaymentInput(StrictModel):
    student_code: str
    currency: str = Field(default="INR", pattern=r"^[A-Z]{3}$")
    method: Literal["cash", "bank_transfer", "cheque"]
    transaction_reference: str = Field(min_length=1, max_length=120)
    paid_on: date
    allocations: dict[str, Decimal] = Field(min_length=1, max_length=100)

    @field_validator("allocations")
    @classmethod
    def positive(cls, values):
        if any(
            not v.is_finite() or v <= 0 or v.as_tuple().exponent < -2
            for v in values.values()
        ):
            raise ValueError("Amounts must be positive, with at most two decimals")
        return values


class AdjustmentInput(StrictModel):
    charge_code: str
    adjustment_type: Literal["discount", "waiver"]
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    reason: str = Field(min_length=5, max_length=1000)


class ReviewInput(StrictModel):
    status: Literal["verified", "rejected", "waived"]
    reason: str = Field(min_length=5, max_length=1000)


class EnrollmentInput(StrictModel):
    section_code: str
    roll_number: str = Field(min_length=1, max_length=100)
    student_details: dict


class HostelApprovalInput(StrictModel):
    pickup_person_name: str = Field(min_length=2, max_length=120)
    pickup_relationship: str = Field(min_length=2, max_length=80)
    pickup_contact: str = Field(min_length=7, max_length=25)


class ScholarshipInput(StrictModel):
    student_scholarship_code: str
    allocations: dict[str, Decimal] = Field(min_length=1, max_length=100)

    @field_validator("allocations")
    @classmethod
    def amounts(cls, values):
        if any(
            not v.is_finite() or v <= 0 or v.as_tuple().exponent < -2
            for v in values.values()
        ):
            raise ValueError("Amounts must be positive with at most two decimals")
        return values
