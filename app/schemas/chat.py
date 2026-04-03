from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SeverityLevel


class ChatRequest(BaseModel):
    message: str = Field(min_length=2, max_length=3000)
    symptoms: str | None = Field(default=None, max_length=1000)
    attachment_url: str | None = Field(default=None, max_length=500)


class ChatDoctorNote(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    doctor_id: int
    notes: str
    diagnosis: str | None
    recommendation: str | None
    message_to_patient: str | None
    patient_reply: str | None
    patient_reply_at: datetime | None
    created_at: datetime


class ChatHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symptoms: str | None
    message: str
    response: str
    severity_level: SeverityLevel
    is_flagged: bool
    is_reviewed: bool
    reviewed_at: datetime | None
    risk_reason: str | None
    attachment_url: str | None = None
    created_at: datetime
    doctor_notes: list[ChatDoctorNote] = []


class ChatResponse(BaseModel):
    message: str
    response: str
    severity_level: SeverityLevel
    is_flagged: bool
    is_reviewed: bool = False
    risk_reason: str | None
    attachment_url: str | None = None
    created_at: datetime
