import logging
from functools import lru_cache
from time import perf_counter

from fastapi import HTTPException, status
from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI

from app.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@lru_cache(maxsize=1)
def _get_client() -> OpenAI:
    return OpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url or None,
        timeout=20.0,
    )


def generate_with_openai(prompt: str) -> str:
    client = _get_client()
    started_at = perf_counter()

    try:
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a medical assistant chatbot. "
                        "Follow the instructions in the user message exactly. "
                        "Be concise, safe, and never diagnose with certainty."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=200,
            temperature=0.2,
        )
        text = (response.choices[0].message.content or "").strip()
        elapsed = perf_counter() - started_at
        logger.info("OpenAI %s responded in %.2fs", settings.openai_model, elapsed)

        if not text:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenAI returned an empty response.",
            )
        return text

    except APIConnectionError as exc:
        logger.exception("OpenAI connection error")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not connect to OpenAI. Check your network or API key.",
        ) from exc
    except APITimeoutError as exc:
        logger.warning("OpenAI request timed out")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="OpenAI request timed out. Please try again.",
        ) from exc
    except APIStatusError as exc:
        logger.exception("OpenAI API error: %s", exc.message)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI API error: {exc.message}",
        ) from exc
