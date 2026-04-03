import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.enums import UserRole
from app.schemas.user import UserResponse

GENDER_OPTIONS = Literal["Male", "Female", "Other"]
BLOOD_GROUP_OPTIONS = Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
WEIGHT_UNIT_OPTIONS = Literal["kg", "lbs"]

_NAME_RE = re.compile(r"^[A-Za-z\s\-']+$")
_PHONE_RE = re.compile(r"^\+[1-9]\d{0,3}\d{10}$")


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole
    age: int | None = Field(default=None, ge=0, le=120)
    gender: GENDER_OPTIONS | None = None
    phone_number: str | None = Field(default=None, max_length=16)
    blood_group: BLOOD_GROUP_OPTIONS | None = None
    allergies: str | None = Field(default=None, max_length=255)
    weight: float | None = Field(default=None, ge=1, le=500)
    weight_unit: WEIGHT_UNIT_OPTIONS | None = None

    @field_validator("name")
    @classmethod
    def name_letters_only(cls, v: str) -> str:
        if not _NAME_RE.match(v):
            raise ValueError("Name must contain only letters, spaces, hyphens, or apostrophes.")
        return v

    @field_validator("phone_number")
    @classmethod
    def phone_format(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not _PHONE_RE.match(v):
            raise ValueError("Phone must be country code + 10 digits, e.g. +911234567890")
        return v

    @model_validator(mode="after")
    def validate_patient_profile(self) -> "RegisterRequest":
        if self.role == UserRole.patient and (self.age is None or self.gender is None):
            raise ValueError("Patient registration requires age and gender.")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
