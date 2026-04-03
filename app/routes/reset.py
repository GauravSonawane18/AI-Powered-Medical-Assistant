"""
Password reset flow (OTP-based):
  POST /password-reset/request  { email }         → sends OTP to email
  POST /password-reset/confirm  { token, new_password } → resets password
"""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.services.email_service import generate_otp, send_password_reset_email
from app.utils.security import get_password_hash

router = APIRouter()
logger = logging.getLogger(__name__)
TOKEN_TTL_MINUTES = 30


class ResetRequestBody(BaseModel):
    email: str


class ResetConfirmBody(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


@router.post("/password-reset/request", status_code=status.HTTP_200_OK)
async def request_reset(payload: ResetRequestBody, db: Session = Depends(get_db)) -> dict:
    # Always return same message to prevent email enumeration
    generic_response = {"message": "If that email is registered, you will receive a reset code shortly."}

    user = db.scalar(select(User).where(User.email == payload.email.lower().strip()))
    if user is None:
        return generic_response

    # Invalidate any existing unused tokens for this user
    existing = db.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False,  # noqa: E712
        )
    ).all()
    for old in existing:
        old.used = True

    otp = generate_otp()
    expires = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_TTL_MINUTES)
    db.add(PasswordResetToken(user_id=user.id, token=otp, expires_at=expires))
    db.commit()

    sent = await send_password_reset_email(
        to_email=user.email,
        user_name=user.name or "User",
        otp=otp,
    )

    if not sent:
        logger.warning("Email not sent for user %s — SMTP may not be configured.", user.email)

    return generic_response


@router.post("/password-reset/confirm", status_code=status.HTTP_200_OK)
def confirm_reset(payload: ResetConfirmBody, db: Session = Depends(get_db)) -> dict:
    record = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token == payload.token.strip())
    )
    if record is None or record.used:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or already used code.")
    if datetime.now(timezone.utc) > record.expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code has expired. Please request a new one.")

    user = db.get(User, record.user_id)
    user.hashed_password = get_password_hash(payload.new_password)
    record.used = True
    db.commit()
    return {"message": "Password reset successfully. You can now log in."}
