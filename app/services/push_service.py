"""
Expo push notification service.
Sends push notifications via the Expo Push API.
"""
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.push_token import PushToken

logger = logging.getLogger(__name__)
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def get_push_token(db: Session, user_id: int) -> str | None:
    row = db.scalar(select(PushToken).where(PushToken.user_id == user_id))
    return row.token if row else None


def save_push_token(db: Session, user_id: int, token: str) -> None:
    existing = db.scalar(select(PushToken).where(PushToken.user_id == user_id))
    if existing:
        existing.token = token
    else:
        db.add(PushToken(user_id=user_id, token=token))
    db.commit()


async def send_push(token: str, title: str, body: str, data: dict | None = None) -> None:
    if not token or not token.startswith("ExponentPushToken"):
        return
    payload = {"to": token, "title": title, "body": body, "sound": "default"}
    if data:
        payload["data"] = data
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(EXPO_PUSH_URL, json=payload)
            resp.raise_for_status()
    except Exception as exc:
        logger.warning("Push notification failed: %s", exc)


async def notify_user(db: Session, user_id: int, title: str, body: str, data: dict | None = None) -> None:
    token = get_push_token(db, user_id)
    if token:
        await send_push(token, title, body, data)
