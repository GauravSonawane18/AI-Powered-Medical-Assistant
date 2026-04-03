from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Patient(Base):
    __tablename__ = "patients"

    legacy_id: Mapped[int | None] = mapped_column("id", Integer, unique=True, nullable=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    patient_code: Mapped[str] = mapped_column(String(20), primary_key=True)
    age: Mapped[int | None] = mapped_column(nullable=True)
    gender: Mapped[str | None] = mapped_column(String(50), nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    blood_group: Mapped[str | None] = mapped_column(String(10), nullable=True)
    allergies: Mapped[str | None] = mapped_column(String(255), nullable=True)
    weight: Mapped[float | None] = mapped_column(nullable=True)
    weight_unit: Mapped[str | None] = mapped_column(String(5), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="patient_profile")
    chats: Mapped[list["Chat"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
        order_by="desc(Chat.created_at)",
    )
    medical_histories: Mapped[list["MedicalHistory"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
        order_by="desc(MedicalHistory.created_at)",
    )
    doctor_notes: Mapped[list["DoctorNote"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
        order_by="desc(DoctorNote.created_at)",
    )

    @property
    def id(self) -> str:
        return self.patient_code

    @property
    def medical_history(self) -> list["MedicalHistory"]:
        return self.medical_histories
