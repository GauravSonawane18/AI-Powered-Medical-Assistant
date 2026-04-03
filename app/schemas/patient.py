from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.chat import ChatHistoryItem
from app.schemas.user import UserResponse


class MedicalHistoryCreate(BaseModel):
    patient_id: int
    condition: str = Field(min_length=2, max_length=150)
    notes: str | None = Field(default=None, max_length=2000)


class MedicalHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    condition: str
    notes: str | None
    created_at: datetime


class DoctorNoteEmbeddedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    doctor_id: int
    notes: str
    diagnosis: str | None
    created_at: datetime


class PatientSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_code: str | None
    age: int | None
    gender: str | None
    phone_number: str | None
    blood_group: str | None
    allergies: str | None
    weight: float | None
    weight_unit: str | None
    created_at: datetime
    user: UserResponse


class PatientDetailResponse(PatientSummaryResponse):
    chats: list[ChatHistoryItem]
    medical_history: list[MedicalHistoryResponse]
    doctor_notes: list[DoctorNoteEmbeddedResponse]
