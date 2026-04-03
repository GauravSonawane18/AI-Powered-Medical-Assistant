from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.chat import Chat
from app.models.doctor_note import DoctorNote
from app.models.enums import SeverityLevel
from app.models.medical_history import MedicalHistory
from app.models.patient import Patient
from app.schemas.chat import ChatRequest
from app.services.audit_service import log_action
from app.services.openai_service import generate_with_openai
from app.services.risk_service import RiskAssessment, assess_risk
from app.services.summary_service import get_latest_summary, maybe_summarise


DISCLAIMER = (
    "Disclaimer: I am an AI medical assistant, not a licensed doctor. "
    "My suggestions are informational only and should not replace professional medical advice."
)
CHAT_CONTEXT_LIMIT = 3
MEDICAL_CONTEXT_LIMIT = 3
DOCTOR_NOTE_LIMIT = 3


def _format_history(items: list[str], empty_message: str) -> str:
    return "\n".join(items) if items else empty_message


def _build_prompt(
    patient: Patient,
    payload: ChatRequest,
    risk: RiskAssessment,
    previous_chats: list[Chat],
    medical_history: list[MedicalHistory],
    doctor_notes: list[DoctorNote],
    chat_summary: str | None = None,
) -> str:
    if chat_summary:
        chat_context = f"[AI-generated summary of prior conversations]\n{chat_summary}"
    else:
        chat_context = _format_history(
            [
                f"- Patient: {chat.message}\n  Assistant: {chat.response[:180]}"
                for chat in previous_chats
            ],
            "No prior chat history available.",
        )
    medical_context = _format_history(
        [
            f"- Condition: {entry.condition}; Notes: {(entry.notes or 'No notes')[:140]}"
            for entry in medical_history
        ],
        "No medical history on file.",
    )
    doctor_context = _format_history(
        [
            f"- Note: {note.notes[:140]}; Diagnosis: {(note.diagnosis or 'Not provided')[:80]}"
            for note in doctor_notes
        ],
        "No doctor notes available.",
    )

    escalation_instruction = (
        "High risk: urge urgent evaluation by a licensed doctor or emergency services when appropriate."
        if risk.severity in {SeverityLevel.high, SeverityLevel.critical}
        else "Give simple self-care advice and say when in-person care is needed."
    )

    return f"""
You are a medical assistant chatbot. You are NOT a doctor.
Rules:
- Be concise, calm, and safety-first.
- Do not diagnose with certainty.
- Use plain text only, with at most 4 short sentences and no markdown lists.
- For chest pain, trouble breathing, stroke-like symptoms, seizures, heavy bleeding, or self-harm risk, advise urgent or emergency care.
- End with one brief disclaimer and do not ask follow-up questions unless the symptoms are urgent or unclear.
- Keep the answer under 80 words.

Patient profile:
Age: {patient.age or 'Unknown'} | Gender: {patient.gender or 'Unknown'} | Blood group: {patient.blood_group or 'Unknown'} | Allergies: {patient.allergies or 'Unknown'}

Medical history:
{medical_context}

Doctor notes:
{doctor_context}

Recent chats:
{chat_context}

Current symptoms: {payload.symptoms or 'Not provided'}
Current message: {payload.message}
Risk severity: {risk.severity.value}
Risk reason: {risk.reason or 'No high-risk keywords detected'}

Response guidance:
{escalation_instruction}
""".strip()


def _append_safety_footer(response: str, risk: RiskAssessment) -> str:
    parts = [response.strip()]
    if risk.severity in {SeverityLevel.high, SeverityLevel.critical}:
        parts.append(
            "Important: These symptoms may require prompt medical attention. "
            "Please contact a licensed doctor urgently. If symptoms are severe or worsening, seek emergency care now."
        )
    parts.append(DISCLAIMER)
    return "\n\n".join(parts)


def process_patient_chat(db: Session, patient: Patient, payload: ChatRequest) -> Chat:
    risk = assess_risk(payload.message, payload.symptoms)

    previous_chats = list(
        db.scalars(
            select(Chat)
            .where(Chat.patient_id == patient.id)
            .order_by(Chat.created_at.desc())
            .limit(CHAT_CONTEXT_LIMIT)
        ).all()
    )
    medical_history = list(
        db.scalars(
            select(MedicalHistory)
            .where(MedicalHistory.patient_id == patient.id)
            .order_by(MedicalHistory.created_at.desc())
            .limit(MEDICAL_CONTEXT_LIMIT)
        ).all()
    )
    doctor_notes = list(
        db.scalars(
            select(DoctorNote)
            .where(DoctorNote.patient_id == patient.id)
            .order_by(DoctorNote.created_at.desc())
            .limit(DOCTOR_NOTE_LIMIT)
        ).all()
    )

    # Use AI-generated summary when available, replacing raw recent chats
    chat_summary = get_latest_summary(db, patient.id)
    if chat_summary:
        previous_chats_override = []  # summary replaces individual chats in prompt
    else:
        previous_chats_override = previous_chats

    prompt = _build_prompt(patient, payload, risk, previous_chats_override, medical_history, doctor_notes, chat_summary)
    model_response = generate_with_openai(prompt)
    safe_response = _append_safety_footer(model_response, risk)

    chat = Chat(
        patient_id=patient.id,
        symptoms=payload.symptoms,
        message=payload.message,
        response=safe_response,
        severity_level=risk.severity,
        is_flagged=risk.is_flagged,
        risk_reason=risk.reason,
        attachment_url=payload.attachment_url,
    )
    db.add(chat)
    db.flush()

    if risk.is_flagged:
        condition = f"[Auto-flagged] {risk.reason or 'High-risk chat flagged for review'}"
        notes = f"Patient message: {payload.message}"
        if payload.symptoms:
            notes += f"\nSymptoms: {payload.symptoms}"
        db.add(MedicalHistory(
            patient_id=patient.id,
            condition=condition,
            notes=notes,
        ))

    log_action(db, "chat", user_id=patient.user_id, resource="chat", resource_id=chat.id,
               detail=f"severity={risk.severity.value} flagged={risk.is_flagged}")
    db.commit()
    db.refresh(chat)
    # Auto-summarise if threshold reached (runs after commit so new chat is visible)
    maybe_summarise(db, patient)
    return chat

