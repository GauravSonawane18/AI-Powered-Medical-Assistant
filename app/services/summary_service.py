"""
Auto-summarises a patient's chat history when it exceeds a threshold.
The summary is stored in a dedicated table and injected into LLM prompts
instead of the raw last-N chats, keeping prompts small and fast.
"""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.chat import Chat
from app.models.chat_summary import ChatSummary
from app.models.patient import Patient
from app.services.openai_service import generate_with_openai

logger = logging.getLogger(__name__)

SUMMARY_THRESHOLD = 10   # summarise when this many unsummarised chats exist
CHATS_PER_BATCH = 10     # how many chats to roll into one summary


def _fetch_unsummarised(db: Session, patient_id: str, limit: int) -> list[Chat]:
    summarised_ids_sub = select(ChatSummary.last_chat_id).where(
        ChatSummary.patient_code == patient_id
    )
    return list(
        db.scalars(
            select(Chat)
            .where(Chat.patient_code == patient_id, Chat.id.not_in(summarised_ids_sub))
            .order_by(Chat.created_at.asc())
            .limit(limit)
        ).all()
    )


def maybe_summarise(db: Session, patient: Patient) -> None:
    """Call after each new chat. Creates a summary if threshold is reached."""
    unsummarised = _fetch_unsummarised(db, patient.patient_code, CHATS_PER_BATCH + 1)
    if len(unsummarised) < SUMMARY_THRESHOLD:
        return

    batch = unsummarised[:CHATS_PER_BATCH]
    convo = "\n".join(
        f"Patient: {c.message[:200]}\nAI: {c.response[:200]}"
        for c in batch
    )
    prompt = (
        "Summarise the following patient-AI medical conversations in 3–5 concise bullet points. "
        "Focus on symptoms, concerns, and AI recommendations. Plain text only.\n\n" + convo
    )
    try:
        summary_text = generate_with_openai(prompt)
    except Exception:
        logger.warning("Summary generation failed — skipping.")
        return

    entry = ChatSummary(
        patient_code=patient.patient_code,
        summary=summary_text,
        last_chat_id=batch[-1].id,
        chat_count=len(batch),
    )
    db.add(entry)
    db.flush()
    logger.info("Created chat summary for patient %s covering %d chats.", patient.patient_code, len(batch))


def get_latest_summary(db: Session, patient_id: str) -> str | None:
    row = db.scalar(
        select(ChatSummary)
        .where(ChatSummary.patient_code == patient_id)
        .order_by(ChatSummary.created_at.desc())
        .limit(1)
    )
    return row.summary if row else None
