from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.chat import Chat
from app.models.doctor_note import DoctorNote
from app.models.medical_history import MedicalHistory
from app.models.patient import Patient
from app.models.user import User
from app.schemas.doctor import DoctorNoteCreate, FlaggedConversationResponse
from app.schemas.patient import MedicalHistoryCreate
from app.services.audit_service import log_action


def _get_patient_or_404(db: Session, patient_id: str) -> Patient:
    statement = (
        select(Patient)
        .options(
            joinedload(Patient.user),
            joinedload(Patient.chats).joinedload(Chat.doctor_notes),
            joinedload(Patient.medical_histories),
            joinedload(Patient.doctor_notes),
        )
        .where(Patient.patient_code == patient_id)
    )
    patient = db.execute(statement).unique().scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    return patient


def list_patients(db: Session) -> list[Patient]:
    statement = select(Patient).options(joinedload(Patient.user)).order_by(Patient.created_at.desc())
    return list(db.scalars(statement).unique().all())


def get_patient_details(db: Session, patient_id: str) -> Patient:
    return _get_patient_or_404(db, patient_id)


def list_flagged_conversations(db: Session, limit: int = 100) -> list[FlaggedConversationResponse]:
    statement = (
        select(Chat, Patient, User)
        .join(Patient, Chat.patient_code == Patient.patient_code)
        .join(User, Patient.user_id == User.id)
        .where(Chat.is_flagged.is_(True))
        .order_by(Chat.created_at.desc())
        .limit(limit)
    )

    rows = db.execute(statement).all()
    return [
        FlaggedConversationResponse(
            id=chat.id,
            patient_id=patient.id,
            patient_name=user.name,
            patient_code=patient.patient_code,
            message=chat.message,
            response=chat.response,
            severity_level=chat.severity_level,
            is_reviewed=chat.is_reviewed,
            risk_reason=chat.risk_reason,
            created_at=chat.created_at,
        )
        for chat, patient, user in rows
    ]


def add_doctor_note(db: Session, current_doctor: User, payload: DoctorNoteCreate) -> DoctorNote:
    chat = db.scalar(select(Chat).where(Chat.id == payload.chat_id))
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")

    note = DoctorNote(
        doctor_id=current_doctor.id,
        patient_code=chat.patient_code,
        chat_id=chat.id,
        notes=payload.notes,
        diagnosis=payload.diagnosis,
        recommendation=payload.recommendation,
        message_to_patient=payload.message_to_patient,
    )
    db.add(note)
    log_action(db, "add_doctor_note", user_id=current_doctor.id, resource="doctor_note",
               resource_id=None, detail=f"chat_id={chat.id} patient_code={chat.patient_code}")
    db.commit()
    db.refresh(note)
    return note


def mark_chat_reviewed(db: Session, chat_id: int) -> Chat:
    from datetime import datetime, timezone
    chat = db.scalar(select(Chat).where(Chat.id == chat_id))
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
    chat.is_reviewed = True
    chat.reviewed_at = datetime.now(timezone.utc)
    log_action(db, "mark_reviewed", resource="chat", resource_id=chat_id)
    db.commit()
    db.refresh(chat)
    return chat


def reply_to_note(db: Session, note_id: int, patient_id: str, reply: str) -> DoctorNote:
    from datetime import datetime, timezone
    note = db.scalar(select(DoctorNote).where(DoctorNote.id == note_id, DoctorNote.patient_code == patient_id))
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found.")
    note.patient_reply = reply
    note.patient_reply_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(note)
    return note


def add_medical_history_entry(db: Session, payload: MedicalHistoryCreate) -> MedicalHistory:
    _get_patient_or_404(db, payload.patient_id)

    entry = MedicalHistory(
        patient_code=payload.patient_id,
        condition=payload.condition,
        notes=payload.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
