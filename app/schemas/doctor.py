from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SeverityLevel


class DoctorNoteCreate(BaseModel):
    chat_id: int
    notes: str = Field(default="", max_length=4000)
    diagnosis: str | None = Field(default=None, max_length=2000)
    recommendation: str | None = Field(default=None, max_length=2000)
    message_to_patient: str | None = Field(default=None, max_length=2000)


class PatientReplyCreate(BaseModel):
    reply: str = Field(min_length=1, max_length=2000)


class DoctorNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    doctor_id: int
    patient_id: str
    chat_id: int | None
    notes: str
    diagnosis: str | None
    recommendation: str | None
    message_to_patient: str | None
    patient_reply: str | None
    patient_reply_at: datetime | None
    created_at: datetime


class FlaggedConversationResponse(BaseModel):
    id: int
    patient_id: str
    patient_name: str
    patient_code: str | None = None
    message: str
    response: str
    severity_level: SeverityLevel
    is_reviewed: bool
    risk_reason: str | None
    created_at: datetime


class ReviewResponse(BaseModel):
    id: int
    is_reviewed: bool
    reviewed_at: datetime | None
