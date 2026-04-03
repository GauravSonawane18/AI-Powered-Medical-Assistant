from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.patient import Patient
from app.schemas.chat import ChatHistoryItem, ChatRequest, ChatResponse
from app.schemas.doctor import DoctorNoteResponse, PatientReplyCreate
from app.schemas.patient import MedicalHistoryResponse, PatientSummaryResponse
from app.services.chat_service import process_patient_chat
from app.services.doctor_service import reply_to_note
from app.services.push_service import notify_user, save_push_token
from app.websocket.manager import manager
from app.services.patient_service import get_medical_history_for_patient, get_patient_summary, list_chat_history
from app.utils.dependencies import get_current_patient

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat_with_assistant(
    payload: ChatRequest,
    patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db),
) -> ChatResponse:
    chat = process_patient_chat(db, patient, payload)
    return ChatResponse(
        message=chat.message,
        response=chat.response,
        severity_level=chat.severity_level,
        is_flagged=chat.is_flagged,
        risk_reason=chat.risk_reason,
        attachment_url=chat.attachment_url,
        created_at=chat.created_at,
    )


@router.get("/chat/history", response_model=list[ChatHistoryItem])
def get_chat_history(
    patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db),
) -> list[ChatHistoryItem]:
    return list_chat_history(db, patient.id)


@router.get("/chat/search", response_model=list[ChatHistoryItem])
def search_chats(
    q: str,
    patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db),
) -> list[ChatHistoryItem]:
    from app.services.patient_service import search_chat_history
    return search_chat_history(db, patient.id, q)


@router.get("/medical-history", response_model=list[MedicalHistoryResponse])
def get_medical_history(
    patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db),
) -> list[MedicalHistoryResponse]:
    return get_medical_history_for_patient(db, patient.id)


@router.post("/notes/{note_id}/reply", response_model=DoctorNoteResponse)
async def reply_to_doctor_note(
    note_id: int,
    payload: PatientReplyCreate,
    patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db),
) -> DoctorNoteResponse:
    note = reply_to_note(db, note_id, patient.id, payload.reply)
    # Push notification to doctor
    await notify_user(db, note.doctor_id, "Patient Reply",
                      f"{patient.user.name if hasattr(patient, 'user') and patient.user else 'Patient'} replied to your note.",
                      {"type": "patient_reply", "note_id": note.id})
    # WebSocket push to doctor in real-time
    await manager.send_to(note.doctor_id, {
        "type": "patient_reply",
        "note_id": note.id,
        "chat_id": note.chat_id,
        "patient_id": patient.id,
        "patient_reply": note.patient_reply,
        "patient_reply_at": note.patient_reply_at.isoformat() if note.patient_reply_at else None,
    })
    return note


class PushTokenBody(BaseModel):
    token: str


@router.post("/push-token", status_code=204)
def register_push_token(
    payload: PushTokenBody,
    patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db),
) -> None:
    save_push_token(db, patient.user_id, payload.token)


@router.get("/me", response_model=PatientSummaryResponse)
def get_my_profile(
    patient: Patient = Depends(get_current_patient),
    db: Session = Depends(get_db),
) -> PatientSummaryResponse:
    return get_patient_summary(db, patient.id)
