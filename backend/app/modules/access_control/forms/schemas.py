from typing import Any, Literal

from pydantic import Field, model_validator

from app.core.security import StrictModel


class FormField(StrictModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]{0,63}$")
    label: str = Field(min_length=1, max_length=120)
    type: Literal[
        "text",
        "email",
        "phone",
        "integer",
        "decimal",
        "date",
        "boolean",
        "select",
        "textarea",
    ] = "text"
    required: bool = False
    options: list[str] = Field(default_factory=list, max_length=100)
    section: str = Field(default="", max_length=100)
    help: str = Field(default="", max_length=300)

    @model_validator(mode="after")
    def options_valid(self):
        if self.type == "select" and (
            not self.options or len(set(self.options)) != len(self.options)
        ):
            raise ValueError("Select field needs unique options")
        if any(not x or len(x) > 200 for x in self.options):
            raise ValueError("Invalid select option")
        return self


class FormInput(StrictModel):
    name: str = Field(min_length=2, max_length=120)
    screen: str = Field(min_length=1, max_length=100)
    fields: list[FormField] = Field(min_length=1, max_length=100)
    published: bool = False

    @model_validator(mode="after")
    def unique_keys(self):
        if len({f.key for f in self.fields}) != len(self.fields):
            raise ValueError("Field keys must be unique")
        return self


class SubmissionInput(StrictModel):
    revision: int = Field(ge=1)
    values: dict[str, Any]
