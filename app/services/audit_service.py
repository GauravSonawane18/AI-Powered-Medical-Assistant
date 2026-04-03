from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_action(
    db: Session,
    action: str,
    user_id: int | None = None,
    resource: str | None = None,
    resource_id: int | None = None,
    detail: str | None = None,
) -> None:
    entry = AuditLog(
        user_id=user_id,
        action=action,
        resource=resource,
        resource_id=resource_id,
        detail=detail,
    )
    db.add(entry)
    # Flush only — caller commits with their transaction
    db.flush()
