import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.incident import Incident
from app.models.models import AIAnalysis
from app.schemas import RCAOut
from app.services.correlation.incident_context import build_incident_context
from app.services.ai.prompt_builder import build_prompt
from app.services.ai.llm_client import call_llm, LLMUnavailableError
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/incidents/{incident_id}/analyze", response_model=RCAOut)
def analyze_incident(incident_id: int, db: Session = Depends(get_db)):
    """
    POST /api/v1/ai/incidents/{id}/analyze

    Pipeline:
      1. Load the incident (404 if missing).
      2. Build the incident context dict.
      3. Build the LLM prompt.
      4. Call the LLM (Gemini).
      5. Validate the response against RCAOut.
      6. Persist the analysis as an AIAnalysis row.
      7. Return the structured result.

    On LLM failure → HTTP 503 with a clear error message.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    context = build_incident_context(incident)
    prompt = build_prompt(context)

    try:
        raw = call_llm(prompt)
    except LLMUnavailableError as exc:
        logger.error("LLM unavailable for incident %d: %s", incident_id, exc)
        raise HTTPException(
            status_code=503,
            detail="AI analysis unavailable — LLM could not be reached. Please try again later.",
        )

    # Validate shape with Pydantic before persisting
    try:
        rca = RCAOut(**raw)
    except Exception as exc:
        logger.error("LLM response failed schema validation for incident %d: %s", incident_id, exc)
        raise HTTPException(
            status_code=503,
            detail="AI analysis unavailable — response from LLM was malformed.",
        )

    # Persist the analysis
    analysis = AIAnalysis(
        incident_id=incident.id,
        model_used=settings.GEMINI_MODEL,
        response_json=raw,
        confidence=rca.confidence,
        status="success",
        prompt=prompt,
        response=str(raw),
    )
    db.add(analysis)
    db.commit()

    return rca
