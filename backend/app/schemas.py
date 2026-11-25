"""Request and response contracts shared by the API endpoints."""

from datetime import date
from typing import Annotated
import unicodedata
from zoneinfo import ZoneInfo
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

from .options import FIELD_OPTIONS


def clean_name(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("Name must be text")
    if any(unicodedata.category(char) == "Cf" for char in value):
        raise ValueError("Name can contain letters only")
    name = " ".join(unicodedata.normalize("NFC", value).split())
    if not name:
        raise ValueError("Name is required")
    if len(name) > 100:
        raise ValueError("Name must be 100 characters or fewer")
    for part in name.split(" "):
        if not unicodedata.category(part[0]).startswith("L"):
            raise ValueError("Name can contain letters only")
        if any(not unicodedata.category(char).startswith(("L", "M")) for char in part[1:]):
            raise ValueError("Name can contain letters only")
    return name


def valid_choice(field: str, value: str) -> str:
    if value not in FIELD_OPTIONS[field]:
        raise ValueError(f"Please select a valid {field}")
    return value


class PatientInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    age: StrictInt = Field(ge=0, le=120)
    gender: str
    ward: str
    department: str
    doctor: str
    admission_date: date

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return clean_name(value)

    @field_validator("gender", "ward", "department", "doctor")
    @classmethod
    def validate_choice(cls, value: str, info) -> str:
        return valid_choice(info.field_name, value)

    @field_validator("admission_date")
    @classmethod
    def validate_date(cls, value: date) -> date:
        if value > datetime.now(ZoneInfo("Asia/Kolkata")).date():
            raise ValueError("Admission date cannot be in the future")
        return value


class PatientQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    search: str | None = None
    ward: str | None = None
    department: str | None = None
    doctor: str | None = None
    page: Annotated[int, Field(ge=1)] = 1

    @field_validator("ward", "department", "doctor")
    @classmethod
    def validate_filter(cls, value: str | None, info) -> str | None:
        if value is None:
            return None
        return valid_choice(info.field_name, value)

    @field_validator("search")
    @classmethod
    def clean_search(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned[:100] or None


class PatientOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    age: int
    gender: str
    ward: str
    department: str
    doctor: str
    admission_date: date
    status: str


class PatientPage(BaseModel):
    patients: list[PatientOutput]
    total: int
    page: int
    total_pages: int
    page_size: int = 100


class PatientSummary(BaseModel):
    total: int
    admitted: int
    discharged: int
    active_wards: int
