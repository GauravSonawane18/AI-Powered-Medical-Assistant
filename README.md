# AI-Powered Medical Assistant

AI-Powered Medical Assistant is a FastAPI + Expo mobile application for patient support, doctor review, and AI-assisted symptom guidance. Patients can register, chat with the assistant, upload files, and receive doctor notes. Doctors can review flagged chats, search patients, add notes, and update medical history in real time.

## Core Features

- JWT-based authentication for `patient`, `doctor`, and `admin`
- AI-assisted medical chat using an OpenAI-compatible API
- Risk scoring with `low`, `medium`, `high`, and `critical` severity
- Doctor dashboard for flagged conversations and patient review
- Medical history management
- Password reset by OTP email
- File upload support
- WebSocket-based real-time doctor and patient updates
- Expo React Native mobile app

## Tech Stack

- Backend: FastAPI, SQLAlchemy, Pydantic Settings
- Mobile: Expo, React Native
- Database: PostgreSQL
- Auth: JWT with `python-jose`
- AI client: OpenAI Python SDK

## Project Structure

```text
AI-Powered Medical Assistant/
|-- app/
|   |-- config/
|   |-- database/
|   |-- models/
|   |-- routes/
|   |-- schemas/
|   |-- services/
|   |-- utils/
|   `-- main.py
|-- mobile/
|   |-- src/
|   |-- App.js
|   `-- package.json
|-- data/
|-- requirements.txt
`-- README.md
```

## Database Design

This project is currently aligned to a PostgreSQL schema where:

- `patients.patient_code` is the effective primary identifier used by the app
- patient-linked tables such as `chats`, `doctor_notes`, `medical_history`, and `chat_summaries` use `patient_code`
- `patients.user_id` links each patient row to the authenticated user row

If you already have project data in PostgreSQL, keep using that database. Do not switch to a fresh SQLite database unless you intentionally want a separate local dataset.

## Prerequisites

- Python 3.12+
- Node.js 18+
- npm
- PostgreSQL

## Backend Setup

Create and activate a virtual environment in Bash:

```bash
python -m venv .venv
source .venv/Scripts/activate
```

Install backend dependencies:

```bash
pip install -r requirements.txt
pip install openai
```

Create a `.env` file in the project root:

```env
APP_NAME=AI-Powered Medical Assistant
APP_VERSION=1.0.0
DEBUG=false
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/medibotdb
JWT_SECRET_KEY=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=
CORS_ORIGINS=["*"]
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM_NAME=MedAssist
APP_BASE_URL=http://localhost:8000
```

Notes:

- `DATABASE_URL` can be written as `postgresql://...`; the app normalizes it to `postgresql+psycopg://...`
- `SMTP_*` values are required if you want password reset emails to work
- `OPENAI_BASE_URL` can be left blank for OpenAI, or set to a compatible provider endpoint such as Groq

Start the backend:

```bash
uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000
```

Backend URLs:

- API docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

## Mobile Setup

Install mobile dependencies:

```bash
cd mobile
npm install
```

Update the API base URL in `mobile/src/api.js`.

Use one of these values:

- Physical device: `http://YOUR_PC_LAN_IP:8000`
- Android emulator: `http://10.0.2.2:8000`

Start the Expo app:

```bash
npx expo start
```

Useful commands:

```bash
npm run android
npx expo start --tunnel
```

Use `--tunnel` if your phone and laptop are not on the same Wi-Fi network.

## Main API Endpoints

Public:

- `POST /register`
- `POST /login`
- `GET /health`
- `POST /password-reset/request`
- `POST /password-reset/confirm`

Patient:

- `GET /me`
- `POST /chat`
- `GET /chat/history`
- `GET /chat/search?q=...`
- `GET /medical-history`
- `POST /notes/{note_id}/reply`
- `POST /push-token`
- `POST /upload`

Doctor/Admin:

- `GET /patients`
- `GET /patients/{patient_id}`
- `GET /doctor/notifications`
- `GET /doctor/flagged-chats`
- `POST /doctor/chats/{chat_id}/review`
- `POST /doctor/notes`
- `POST /doctor/medical-history`
- `POST /doctor/push-token`
- `GET /doctor/audit-log`

Realtime:

- `WS /ws?token=<jwt>`

## Important Notes

- The mobile client uses a hardcoded API base URL in `mobile/src/api.js`
- Uploaded files are stored under `app/uploads/`
- Database tables are created on startup and lightweight non-destructive migrations run automatically
- Password reset depends on working SMTP credentials
- The assistant is for guidance and escalation, not final medical diagnosis
