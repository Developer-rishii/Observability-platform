import logging
import time
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.incident import Incident
from app.models.models import AIAnalysis
from app.schemas import RCAOut, KnowledgeSourceItem
from app.services.correlation.incident_context import build_incident_context
from app.services.ai.prompt_builder import build_prompt
from app.services.ai.llm_client import call_llm, LLMUnavailableError
from app.core.config import settings

def _get_rag_search():
    """Retrieve search function from app.rag.retriever lazily to prevent module collection failures if vector deps absent."""
    try:
        from app.rag.retriever import search
        return search
    except Exception as exc:
        logger.warning("RAG retriever import failed: %s", exc)
        return None

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory registry for per-incident cooldown timestamps: {incident_id: timestamp_float}
# On process restart, the in-memory dictionary resets, allowing diagnostics immediately.
# For demo and production multi-workers this avoids state leakage, and persistent DB state remains in ai_analyses.
_incident_last_analysis_time: Dict[int, float] = {}


def reset_cooldown_cache():
    """Helper for testing to reset cooldown cache."""
    _incident_last_analysis_time.clear()


@router.post("/incidents/{incident_id}/analyze", response_model=RCAOut)
def analyze_incident(incident_id: int, db: Session = Depends(get_db)):
    """
    POST /api/v1/ai/incidents/{id}/analyze

    Pipeline:
      1. Load the incident (404 if missing).
      2. Check per-incident cooldown window (ANALYSIS_COOLDOWN_SECONDS, default 60s).
         Returns HTTP 429 with {"detail": "...", "code": "analysis_cooldown", "retryAfterSeconds": n}
         and does NOT call Gemini.
      3. Retrieve relevant runbook chunks from Qdrant vector database.
      4. Build incident prompt including delimited reference material.
      5. Call Gemini LLM (with timeout, retry, safe failure handling).
      6. Validate response against RCAOut schema.
      7. Persist analysis row and return result with knowledgeSources.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    # 1. Per-incident cooldown check
    now = time.time()
    last_run = _incident_last_analysis_time.get(incident_id)
    cooldown_window = getattr(settings, "ANALYSIS_COOLDOWN_SECONDS", 60)
    if last_run is not None:
        elapsed = now - last_run
        if elapsed < cooldown_window:
            remaining = int(cooldown_window - elapsed)
            logger.info(
                "Analysis cooldown active for incident %d: %ds remaining. Rejecting request with 429.",
                incident_id,
                remaining,
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Analysis cooldown active for incident {incident_id}. Please wait {remaining} seconds before re-running diagnostics.",
                headers={"Retry-After": str(remaining)},
            )

    # 2. Build incident context
    context = build_incident_context(incident)

    # 3. RAG Retrieval from Qdrant
    rag_chunks: List[Dict[str, Any]] = []
    knowledge_sources: List[KnowledgeSourceItem] = []
    try:
        query_terms = [
            context.get("title", ""),
            context.get("metric_name", ""),
            context.get("affected_service", ""),
            context.get("description", ""),
        ]
        query = " ".join(t for t in query_terms if t).strip()
        top_k = getattr(settings, "RAG_TOP_K", 5)
        min_score = getattr(settings, "RAG_MIN_SCORE", 0.45)
        search_fn = _get_rag_search()
        if search_fn is not None:
            rag_chunks = search_fn(query=query, k=top_k, min_score=min_score)

        for chunk in rag_chunks:
            knowledge_sources.append(
                KnowledgeSourceItem(
                    title=chunk.get("title", ""),
                    section=chunk.get("section", ""),
                    score=chunk.get("score"),
                    source_file=chunk.get("source_file"),
                )
            )
    except Exception as rag_err:
        logger.warning(
            "Qdrant RAG retrieval failed for incident %d: %s. Continuing with metric-only context.",
            incident_id,
            rag_err,
        )
        rag_chunks = []
        knowledge_sources = []

    # 4. Build prompt
    prompt = build_prompt(context, rag_chunks=rag_chunks)

    # 5. Call LLM
    try:
        raw = call_llm(prompt)
    except LLMUnavailableError as exc:
        logger.error("LLM unavailable for incident %d: %s (code=%s)", incident_id, exc, getattr(exc, "code", "llm_unavailable"))
        raise HTTPException(
            status_code=503,
            detail="AI analysis unavailable — LLM service could not be reached. Please check your configuration and try again later.",
        )

    # 6. Validate shape with Pydantic before persisting
    try:
        raw["knowledge_sources"] = [ks.model_dump() for ks in knowledge_sources]
        raw["knowledgeSources"] = [ks.model_dump() for ks in knowledge_sources]
        rca = RCAOut(**raw)
    except Exception as exc:
        logger.error("LLM response failed schema validation for incident %d: %s", incident_id, exc)
        raise HTTPException(
            status_code=503,
            detail="AI analysis unavailable — response from LLM was malformed or incomplete.",
        )

    # Update cooldown timestamp on successful analysis call
    _incident_last_analysis_time[incident_id] = time.time()

    # 7. Persist analysis
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


# ---------------------------------------------------------------------------
# Ask AI Incident Chat (OpenAI)
# ---------------------------------------------------------------------------
from app.api.deps import get_current_user
from app.models.models import User
from app.schemas import (
    IncidentChatRequest,
    IncidentChatResponse,
    IncidentChatStatus,
)
from app.services.ai.openai_chat import (
    get_chat_provider,
    OpenAIChatError,
    OpenAIChatDisabledError,
    OpenAIChatAuthError,
    OpenAIChatRateLimitError,
    OpenAIChatTimeoutError,
)
from app.services.ai.chat_context_builder import (
    build_chat_context,
    build_system_prompt,
)

# In-memory rate limiting:
# 1 request per 2 seconds per user/incident
# max 30 requests per hour per user/incident
_chat_rate_limits: Dict[str, List[float]] = {}


def _check_chat_rate_limit(key: str):
    """Enforce 1 req / 2s and 30 req / 3600s."""
    now = time.time()
    history = _chat_rate_limits.get(key, [])
    # Evict timestamps older than 1 hour
    history = [t for t in history if now - t < 3600]

    if history:
        # Check 2-second cooldown
        last_req = history[-1]
        if now - last_req < 2.0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded: please wait at least 2 seconds between questions.",
            )
        # Check hourly cap
        if len(history) >= 30:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Hourly rate limit exceeded: maximum 30 questions per hour.",
            )

    history.append(now)
    _chat_rate_limits[key] = history


@router.get("/chat/status", response_model=IncidentChatStatus)
def get_chat_status(current_user: User = Depends(get_current_user)):
    """Check whether Ask AI chat is configured with an active API key."""
    provider = get_chat_provider()
    return IncidentChatStatus(
        configured=provider.is_configured(),
        model=getattr(provider, "model", "qwen/qwen3.8-27b"),
    )


@router.post("/incidents/{incident_id}/chat", response_model=IncidentChatResponse)
def chat_with_incident_ai(
    incident_id: int,
    payload: IncidentChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    POST /api/v1/ai/incidents/{incident_id}/chat
    Interactive Ask AI conversation anchored strictly to that incident's data.
    """
    provider = get_chat_provider()
    if not provider.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI chat is disabled or not configured.",
        )

    # 1. Input message validation
    msg = (payload.message or "").strip()
    if not msg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty.",
        )
    if len(msg) > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message exceeds maximum allowed length of 500 characters.",
        )

    # 2. Rate limit check (keyed by user_id and incident_id)
    rate_key = f"{current_user.id}:{incident_id}"
    _check_chat_rate_limit(rate_key)

    # 3. Load incident
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident #{incident_id} not found.",
        )

    # 4. Context assembly
    context_text, context_summary = build_chat_context(db, incident)
    system_prompt = build_system_prompt(incident.id, context_text)

    # 5. Sanitize and bound conversation history (keep last 6 turns, each max 1000 chars)
    raw_history = payload.history or []
    bounded_history: List[Dict[str, str]] = []
    for h in raw_history[-6:]:
        role = "assistant" if h.role == "assistant" else "user"
        content = (h.content or "")[:1000]
        bounded_history.append({"role": role, "content": content})

    # Append current user question
    bounded_history.append({"role": "user", "content": msg})

    # Check whether a stored analysis exists
    stored_rca = db.query(AIAnalysis).filter(AIAnalysis.incident_id == incident.id).first()
    used_analysis = stored_rca is not None and stored_rca.response_json is not None

    # 6. Call OpenAI via Provider
    try:
        answer = provider.generate(system_prompt, bounded_history)
    except OpenAIChatDisabledError as exc:
        raise HTTPException(status_code=503, detail="AI chat is disabled or not configured.")
    except OpenAIChatAuthError as exc:
        raise HTTPException(status_code=503, detail="AI chat is not configured.")
    except OpenAIChatRateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc) or "Rate limit exceeded from AI provider. Please wait a moment.")
    except (OpenAIChatTimeoutError, OpenAIChatError) as exc:
        raise HTTPException(status_code=503, detail="AI chat temporarily unavailable.")
    except Exception as exc:
        logger.error(f"Unexpected chat failure for incident {incident_id}: {exc}", exc_info=True)
        raise HTTPException(status_code=503, detail="AI chat temporarily unavailable.")

    return IncidentChatResponse(
        answer=answer,
        used_analysis=used_analysis,
        context_summary=context_summary,
    )
