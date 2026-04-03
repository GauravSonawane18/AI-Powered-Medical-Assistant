import random
import re

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.chat import Chat
from app.models.doctor_note import DoctorNote
from app.models.medical_history import MedicalHistory
from app.models.patient import Patient


def generate_patient_code(db: Session, name: str) -> str:
    """Generate a unique MDBT-XXXX style patient code (e.g. MDBT-4832)."""
    existing = {
        row[0] for row in db.execute(
            select(Patient.patient_code).where(Patient.patient_code.ilike("MDBT-%"))
        ).fetchall()
        if row[0]
    }
    for _ in range(200):
        code = f"MDBT-{random.randint(1000, 9999)}"
        if code not in existing:
            return code
    # All 9000 4-digit slots taken — extend to 5 digits
    return f"MDBT-{random.randint(10000, 99999)}"


def get_patient_by_user_id(db: Session, user_id: int) -> Patient | None:
    return db.scalar(select(Patient).where(Patient.user_id == user_id))


def get_patient_summary(db: Session, patient_id: int) -> Patient:
    patient = db.scalar(
        select(Patient)
        .options(joinedload(Patient.user))
        .where(Patient.id == patient_id)
    )
    if patient is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    return patient


def search_chat_history(db: Session, patient_id: int, query: str, limit: int = 50) -> list[Chat]:
    from sqlalchemy import or_
    term = f"%{query}%"
    statement = (
        select(Chat)
        .options(joinedload(Chat.doctor_notes))
        .where(
            Chat.patient_id == patient_id,
            or_(Chat.message.ilike(term), Chat.response.ilike(term), Chat.symptoms.ilike(term)),
        )
        .order_by(Chat.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(statement).unique().all())


def list_chat_history(db: Session, patient_id: int, limit: int = 50) -> list[Chat]:
    statement = (
        select(Chat)
        .options(joinedload(Chat.doctor_notes))
        .where(Chat.patient_id == patient_id)
        .order_by(Chat.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(statement).unique().all())


def get_medical_history_for_patient(db: Session, patient_id: int, limit: int = 50) -> list[MedicalHistory]:
    statement = (
        select(MedicalHistory)
        .where(MedicalHistory.patient_id == patient_id)
        .order_by(MedicalHistory.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(statement).all())
