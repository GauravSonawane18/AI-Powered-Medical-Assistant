# Medibot

Medibot is an AI-assisted medical support platform built with a FastAPI backend and an Expo React Native mobile app. It helps patients describe symptoms, receive safe first-pass guidance, and lets doctors review flagged conversations, add notes, and update medical records in real time.

## Features

- JWT-based authentication with patient, doctor, and admin roles
- Patient onboarding with profile details like age, gender, blood group, allergies, phone number, and weight
- AI chat responses generated from an OpenAI-compatible model
- Prompt context enriched with recent chats, medical history, and doctor notes
- Keyword-based risk scoring with `low`, `medium`, `high`, and `critical` severity levels
- Automatic flagging of urgent or risky messages for doctor review
- Doctor workflow for reviewing flagged chats, writing notes, and sending messages back to patients
- Real-time updates over WebSockets for doctor notes and patient replies
- Mobile-first interface built with Expo and React Native

## Tech Stack

- Backend: FastAPI, SQLAlchemy, Pydantic, PostgreSQL or SQLite
- Auth: JWT with `python-jose` and password hashing with `passlib`
- AI: OpenAI-compatible chat completions API
- Mobile: Expo, React Native, AsyncStorage
- Realtime: FastAPI WebSocket endpoint

## Repository Structure

```text
Medibot/
|-- app/
|   |-- config/        # App settings and environment parsing
|   |-- database/      # SQLAlchemy engine and base setup
|   |-- models/        # ORM models
|   |-- routes/        # REST and WebSocket routes
|   |-- schemas/       # Request/response models
|   |-- services/      # Auth, chat, doctor, patient, and risk logic
|   |-- utils/         # Security, dependencies, logging
|   `-- main.py        # FastAPI entrypoint
|-- mobile/
|   |-- src/
|   |   |-- screens/   # Auth, patient, and doctor app screens
|   |   |-- components/# Shared mobile UI pieces
|   |   `-- api.js     # Mobile API client
|   |-- App.js
|   `-- package.json
|-- data/
|   `-- Medical_book.pdf
|-- requirements.txt
|-- .env.example
`-- README.md
```

## How It Works

1. A patient registers, logs in, and submits a symptom or health-related message.
2. The backend scores the message for risk using keyword-based triage rules.
3. The AI response is generated with patient context, recent chats, medical history, and doctor notes.
4. High-risk chats are flagged for a doctor, who can review the conversation, add notes, and message the patient.
5. Doctor notes and patient replies are pushed in real time through the WebSocket channel.

## API Overview

### Public

- `POST /register` - create a new account
- `POST /login` - authenticate and receive a JWT
- `GET /health` - basic health check

### Patient

- `GET /me` - fetch patient profile
- `POST /chat` - send a message to the AI assistant
- `GET /chat/history` - retrieve past conversations
- `GET /medical-history` - retrieve patient medical history
- `POST /notes/{note_id}/reply` - reply to a doctor's note

### Doctor/Admin

- `GET /patients` - list patients
- `GET /patients/{patient_id}` - fetch detailed patient data
- `GET /doctor/notifications` - unread flagged-chat count
- `GET /doctor/flagged-chats` - list high-priority chats
- `POST /doctor/chats/{chat_id}/review` - mark a flagged chat as reviewed
- `POST /doctor/notes` - add doctor notes or a message to a patient
- `POST /doctor/medical-history` - create a medical history entry

### Realtime

- `WS /ws?token=<jwt>` - authenticated WebSocket for doctor and patient updates

## Local Setup

### 1. Backend

Create and activate a virtual environment:

```bash
python -m venv .venv
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
pip install openai
```

Create a `.env` file in the project root. A simple local setup can use SQLite:

```env
APP_NAME=AI Medical Chatbot API
APP_VERSION=1.0.0
DEBUG=true
DATABASE_URL=sqlite:///./medibot.db
JWT_SECRET_KEY=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=
CORS_ORIGINS=["*"]
```

If you prefer PostgreSQL, use a connection string like:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/medical_chatbot
```

Start the API server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Docs will be available at `http://127.0.0.1:8000/docs`.

### 2. Mobile App

Install mobile dependencies:

```bash
cd mobile
npm install
```

Update the backend URL in `mobile/src/api.js` before launching the app:

- Physical device: use your computer's LAN IP, for example `http://192.168.1.10:8000`
- Android emulator: use `http://10.0.2.2:8000`

Start Expo:

```bash
npx expo start
```

Useful scripts:

```bash
npm run android
npm run ios
npm run build:apk
```

## Risk Detection

The app uses lightweight keyword matching to classify risk before the doctor workflow kicks in.

- `critical`: chest pain, difficulty breathing, stroke, seizure, self-harm, severe bleeding, and similar urgent phrases
- `high`: confusion, severe headache, irregular heartbeat, persistent vomiting, and related phrases
- `medium`: fever, rash, dizziness, dehydration, vomiting, diarrhea, and related phrases

Flagged chats are stored and surfaced to doctors for review.

## Notes

- The assistant is designed for guidance and escalation, not definitive diagnosis.
- Database tables are created automatically on app startup through SQLAlchemy metadata.
- The mobile client currently uses a hardcoded API base URL in `mobile/src/api.js`, so it should be updated for each local network setup.
- The backend uses the OpenAI Python SDK for chat completion requests.

## Future Improvements

- Replace keyword triage with a more robust clinical risk pipeline
- Move the mobile API base URL to environment-driven Expo config
- Add automated tests for backend services and mobile flows
- Add deployment guides for cloud-hosted API and mobile builds

## License

Add a license here before publishing publicly.
