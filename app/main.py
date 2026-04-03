import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config.settings import get_settings
from app.database.base import Base
from app.database.migrations import run_migrations
from app.database.session import SessionLocal, engine
from app.routes.auth import router as auth_router
from app.routes.doctor import router as doctor_router
from app.routes.patient import router as patient_router
from app.routes.reset import router as reset_router
from app.routes.upload import router as upload_router
from app.routes.ws import router as ws_router
from app.utils.logging import configure_logging

settings = get_settings()
configure_logging()


UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        run_migrations(db)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
    description="AI-powered medical chatbot with JWT auth, PostgreSQL, and Groq LLM.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, tags=["Authentication"])
app.include_router(patient_router, tags=["Patient"])
app.include_router(doctor_router, tags=["Doctor"])
app.include_router(reset_router, tags=["Password Reset"])
app.include_router(upload_router, tags=["Upload"])
app.include_router(ws_router, tags=["WebSocket"])

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.get("/health", tags=["Health"])
def health_check() -> dict:
    s = get_settings()
    return {"status": "ok", "smtp_configured": bool(s.smtp_user and s.smtp_password)}
