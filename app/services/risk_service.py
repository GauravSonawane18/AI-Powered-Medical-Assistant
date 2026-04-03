from dataclasses import dataclass

from app.models.enums import SeverityLevel


@dataclass(slots=True)
class RiskAssessment:
    severity: SeverityLevel
    is_flagged: bool
    reason: str | None


CRITICAL_KEYWORDS = {
    "chest pain",
    "difficulty breathing",
    "shortness of breath",
    "suicidal",
    "suicide",
    "self-harm",
    "stroke",
    "seizure",
    "unconscious",
    "fainting",
    "severe bleeding",
}

HIGH_KEYWORDS = {
    "high fever",
    "blood in stool",
    "blood in vomit",
    "pregnancy bleeding",
    "persistent vomiting",
    "confusion",
    "severe headache",
    "numbness",
    "irregular heartbeat",
}

MEDIUM_KEYWORDS = {
    "fever",
    "infection",
    "rash",
    "dizziness",
    "dehydration",
    "vomiting",
    "diarrhea",
}


def assess_risk(message: str, symptoms: str | None = None) -> RiskAssessment:
    combined = f"{message} {symptoms or ''}".lower()

    matched_critical = [keyword for keyword in CRITICAL_KEYWORDS if keyword in combined]
    if matched_critical:
        return RiskAssessment(
            severity=SeverityLevel.critical,
            is_flagged=True,
            reason=f"Critical symptom indicators detected: {', '.join(matched_critical)}.",
        )

    matched_high = [keyword for keyword in HIGH_KEYWORDS if keyword in combined]
    if matched_high:
        return RiskAssessment(
            severity=SeverityLevel.high,
            is_flagged=True,
            reason=f"High-risk symptom indicators detected: {', '.join(matched_high)}.",
        )

    matched_medium = [keyword for keyword in MEDIUM_KEYWORDS if keyword in combined]
    if matched_medium:
        return RiskAssessment(
            severity=SeverityLevel.medium,
            is_flagged=False,
            reason=f"Moderate-risk indicators detected: {', '.join(matched_medium)}.",
        )

    return RiskAssessment(severity=SeverityLevel.low, is_flagged=False, reason=None)
