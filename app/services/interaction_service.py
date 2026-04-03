"""
Simple allergy-vs-recommendation interaction checker.
Uses keyword matching — not a clinical drug database, but catches obvious cases
like recommending penicillin to a patient allergic to penicillin.
"""
from __future__ import annotations

# Common allergen → drug/substance family keywords
ALLERGEN_KEYWORDS: dict[str, list[str]] = {
    "penicillin": ["penicillin", "amoxicillin", "ampicillin", "augmentin", "flucloxacillin"],
    "sulfa": ["sulfamethoxazole", "trimethoprim", "bactrim", "septra", "sulfonamide", "sulfa"],
    "aspirin": ["aspirin", "ibuprofen", "nsaid", "naproxen", "diclofenac", "celecoxib"],
    "codeine": ["codeine", "morphine", "opioid", "tramadol", "hydrocodone"],
    "latex": ["latex"],
    "peanut": ["peanut"],
    "shellfish": ["shellfish", "shrimp", "prawn", "lobster", "crab"],
    "ibuprofen": ["ibuprofen", "nsaid", "naproxen", "diclofenac"],
    "metformin": ["metformin"],
    "statins": ["statin", "atorvastatin", "simvastatin", "rosuvastatin", "pravastatin"],
}


def check_interactions(allergies: str | None, recommendation: str | None) -> list[str]:
    """
    Returns a list of warning strings if any allergy keyword appears in the recommendation.
    Returns [] if no conflicts found.
    """
    if not allergies or not recommendation:
        return []

    allergy_text = allergies.lower()
    rec_text = recommendation.lower()
    warnings: list[str] = []

    for allergen, drugs in ALLERGEN_KEYWORDS.items():
        if allergen in allergy_text or any(d in allergy_text for d in drugs):
            # Patient has this allergy — check if recommendation mentions any related drug
            matches = [d for d in drugs if d in rec_text]
            if matches:
                warnings.append(
                    f"⚠ Potential allergy conflict: patient is allergic to '{allergen}' "
                    f"and recommendation mentions '{', '.join(matches)}'."
                )

    # Also do a simple direct match: any word in allergies against recommendation
    for word in allergy_text.replace(",", " ").split():
        word = word.strip()
        if len(word) > 3 and word in rec_text:
            msg = f"⚠ Allergy keyword '{word}' found in recommendation."
            if msg not in warnings:
                warnings.append(msg)

    return warnings
