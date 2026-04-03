from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.patient import Patient
from app.models.user import User
from app.schemas.auth import RegisterRequest, TokenResponse
from app.schemas.user import UserResponse
from app.services.patient_service import generate_patient_code
from app.utils.security import create_access_token, get_password_hash, verify_password


def register_user(db: Session, payload: RegisterRequest) -> User:
    existing_user = db.scalar(select(User).where(User.email == payload.email))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.")

    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.flush()

    if payload.role.value == "patient":
        patient_code = generate_patient_code(db, payload.name)
        patient = Patient(
            user_id=user.id,
            patient_code=patient_code,
            age=payload.age,
            gender=payload.gender,
            phone_number=payload.phone_number,
            blood_group=payload.blood_group,
            allergies=payload.allergies,
            weight=payload.weight,
            weight_unit=payload.weight_unit,
        )
        db.add(patient)

    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(password, user.hashed_password):
        return None
    return user


def build_token_response(user: User) -> TokenResponse:
    access_token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return TokenResponse(access_token=access_token, user=UserResponse.model_validate(user))
