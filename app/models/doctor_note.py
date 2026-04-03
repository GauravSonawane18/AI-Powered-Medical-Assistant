from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class DoctorNote(Base):
    __tablename__ = "doctor_notes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    patient_code: Mapped[str] = mapped_column(ForeignKey("patients.patient_code", ondelete="CASCADE"), nullable=False)
    chat_id: Mapped[int | None] = mapped_column(ForeignKey("chats.id", ondelete="SET NULL"), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    message_to_patient: Mapped[str | None] = mapped_column(Text, nullable=True)
    patient_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    patient_reply_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    doctor: Mapped["User"] = relationship(back_populates="doctor_notes")
    patient: Mapped["Patient"] = relationship(back_populates="doctor_notes")
    chat: Mapped["Chat"] = relationship(back_populates="doctor_notes")

    @property
    def patient_id(self) -> str:
        return self.patient_code
