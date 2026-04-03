from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import SeverityLevel


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_code: Mapped[str] = mapped_column(ForeignKey("patients.patient_code", ondelete="CASCADE"), nullable=False)
    symptoms: Mapped[str | None] = mapped_column(Text, nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    severity_level: Mapped[SeverityLevel] = mapped_column(
        Enum(SeverityLevel, native_enum=False),
        default=SeverityLevel.low,
        nullable=False,
    )
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_reviewed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    risk_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    patient: Mapped["Patient"] = relationship(back_populates="chats")
    doctor_notes: Mapped[list["DoctorNote"]] = relationship(
        back_populates="chat",
        cascade="all, delete-orphan",
        order_by="asc(DoctorNote.created_at)",
    )

    @property
    def patient_id(self) -> str:
        return self.patient_code
