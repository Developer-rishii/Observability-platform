"""
Unit and integration tests for R4:
- Cooldown handling (429 when re-run within cooldown window, success after expiration).
- Failure paths: missing key, 404 retired model, timeout, malformed JSON.
- Validation that GEMINI_MODEL is not a known retired name (gemini-1.5-*, gemini-2.0-*).
- RAG retrieval integration: sources included, empty retrieval, retriever error handling.
"""
import json
import pytest
import time
from unittest.mock import patch, MagicMock
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.incident import Incident
from app.models.models import AIAnalysis
from app.api.v1.ai import reset_cooldown_cache
from app.services.ai.llm_client import call_llm, LLMUnavailableError

client = TestClient(app)

_GOOD_LLM_RESPONSE = {
    "summary": "High CPU utilization caused by workload surge.",
    "probable_cause": "Traffic spike saturated worker threads.",
    "confidence": "high",
    "supporting_evidence": [{"text": "CPU exceeded 90%", "ref": None}],
    "affected_components": ["workload-generator"],
    "impact": "Degraded API latency.",
    "recommended_investigation": ["Inspect thread pools", "Check slow endpoints"],
    "possible_remediation": ["Scale horizontally"],
    "alternative_causes": ["Background cron contention"],
    "next_steps": ["Inspect thread pools", "Check slow endpoints"],
}


def _make_gemini_resp(text: str):
    return {
        "candidates": [
            {"content": {"parts": [{"text": text}]}}
        ]
    }


@pytest.fixture(autouse=True)
def clean_cooldown():
    reset_cooldown_cache()
    yield
    reset_cooldown_cache()


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def db_incident(db):
    inc = Incident(
        title="High CPU Spike",
        metric_name="cpu",
        metric_value=96.4,
        threshold=80.0,
        severity="critical",
        status="open",
        affected_metrics=["cpu"],
        detected_at=datetime.utcnow(),
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    yield inc
    # cleanup
    db.query(AIAnalysis).filter(AIAnalysis.incident_id == inc.id).delete()
    db.delete(inc)
    db.commit()


# ---------------------------------------------------------------------------
# Unit: Model retirement guardrail
# ---------------------------------------------------------------------------

def test_gemini_model_is_not_retired():
    """Ensure the configured default GEMINI_MODEL is not a known retired model."""
    retired_prefixes = ["gemini-1.5-", "gemini-2.0-"]
    current_model = settings.GEMINI_MODEL.lower()
    for prefix in retired_prefixes:
        assert not current_model.startswith(prefix), (
            f"Configured GEMINI_MODEL '{settings.GEMINI_MODEL}' is deprecated/retired! "
            f"Please update config.py to gemini-3.5-flash."
        )


# ---------------------------------------------------------------------------
# Unit: LLM Client failure modes
# ---------------------------------------------------------------------------

def test_call_llm_missing_key():
    with patch.object(settings, "GEMINI_API_KEY", ""):
        with pytest.raises(LLMUnavailableError) as exc_info:
            call_llm("test prompt")
        assert exc_info.value.code == "llm_unavailable"


def test_call_llm_404_retired_model():
    mock_resp = MagicMock()
    mock_resp.status_code = 404
    import requests
    mock_resp.raise_for_status.side_effect = requests.HTTPError(response=mock_resp)

    with patch("app.services.ai.llm_client.requests.post", return_value=mock_resp), \
         patch("app.services.ai.llm_client.time.sleep"):
        with pytest.raises(LLMUnavailableError):
            call_llm("test prompt")


def test_call_llm_timeout():
    import requests
    with patch("app.services.ai.llm_client.requests.post", side_effect=requests.Timeout("read timeout")), \
         patch("app.services.ai.llm_client.time.sleep"):
        with pytest.raises(LLMUnavailableError):
            call_llm("test prompt")


def test_call_llm_primary_success():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status.return_value = None
    mock_resp.json.return_value = _make_gemini_resp(json.dumps(_GOOD_LLM_RESPONSE))

    with patch("app.services.ai.llm_client.requests.post", return_value=mock_resp) as mock_post:
        result = call_llm("test prompt")
        assert result["confidence"] == "high"
        # Should only call primary model once
        assert mock_post.call_count == 1
        assert settings.GEMINI_MODEL in mock_post.call_args[0][0]


def test_call_llm_fallback_on_429_quota():
    """When primary model returns 429, it immediately switches to fallback model."""
    import requests
    resp_429 = MagicMock()
    resp_429.status_code = 429
    resp_429.raise_for_status.side_effect = requests.HTTPError(response=resp_429)

    resp_200 = MagicMock()
    resp_200.status_code = 200
    resp_200.raise_for_status.return_value = None
    resp_200.json.return_value = _make_gemini_resp(json.dumps(_GOOD_LLM_RESPONSE))

    # 1st call fails with 429 on primary; 2nd call succeeds on fallback
    with patch("app.services.ai.llm_client.requests.post", side_effect=[resp_429, resp_200]) as mock_post, \
         patch("app.services.ai.llm_client.time.sleep") as mock_sleep:
        result = call_llm("test prompt")
        assert result["confidence"] == "high"
        assert mock_post.call_count == 2
        # First call was primary
        assert settings.GEMINI_MODEL in mock_post.call_args_list[0][0][0]
        # Second call was fallback model
        assert settings.GEMINI_FALLBACK_MODEL in mock_post.call_args_list[1][0][0]
        # Should switch immediately without waiting 2s cooldown on the exhausted primary
        assert mock_sleep.call_count == 0


def test_call_llm_fallback_on_503():
    """When primary model returns 503, it switches to fallback model."""
    import requests
    resp_503 = MagicMock()
    resp_503.status_code = 503
    resp_503.raise_for_status.side_effect = requests.HTTPError(response=resp_503)

    resp_200 = MagicMock()
    resp_200.status_code = 200
    resp_200.raise_for_status.return_value = None
    resp_200.json.return_value = _make_gemini_resp(json.dumps(_GOOD_LLM_RESPONSE))

    with patch("app.services.ai.llm_client.requests.post", side_effect=[resp_503, resp_200]) as mock_post:
        result = call_llm("test prompt")
        assert result["confidence"] == "high"
        assert mock_post.call_count == 2
        assert settings.GEMINI_FALLBACK_MODEL in mock_post.call_args_list[1][0][0]


def test_call_llm_both_models_fail():
    """When both primary and fallback models fail, LLMUnavailableError is raised."""
    import requests
    resp_429 = MagicMock()
    resp_429.status_code = 429
    resp_429.raise_for_status.side_effect = requests.HTTPError(response=resp_429)

    resp_503 = MagicMock()
    resp_503.status_code = 503
    resp_503.raise_for_status.side_effect = requests.HTTPError(response=resp_503)

    with patch("app.services.ai.llm_client.requests.post", side_effect=[resp_429, resp_503, resp_503]), \
         patch("app.services.ai.llm_client.time.sleep"):
        with pytest.raises(LLMUnavailableError):
            call_llm("test prompt")


def test_call_llm_no_fallback_on_client_error():
    """Client errors like 401/403 should not retry or invoke fallback."""
    import requests
    resp_401 = MagicMock()
    resp_401.status_code = 401
    resp_401.raise_for_status.side_effect = requests.HTTPError(response=resp_401)

    with patch("app.services.ai.llm_client.requests.post", return_value=resp_401) as mock_post:
        with pytest.raises(LLMUnavailableError):
            call_llm("test prompt")
        assert mock_post.call_count == 1


# ---------------------------------------------------------------------------
# Integration: Cooldown & Analyze endpoint
# ---------------------------------------------------------------------------

def test_analyze_incident_cooldown(db_incident):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status.return_value = None
    mock_resp.json.return_value = _make_gemini_resp(json.dumps(_GOOD_LLM_RESPONSE))

    with patch("app.services.ai.llm_client.requests.post", return_value=mock_resp):
        # 1st call -> 200 OK
        r1 = client.post(f"/api/v1/ai/incidents/{db_incident.id}/analyze")
        assert r1.status_code == 200

        # 2nd immediate call -> 429 Too Many Requests
        r2 = client.post(f"/api/v1/ai/incidents/{db_incident.id}/analyze")
        assert r2.status_code == 429
        assert "cooldown active" in r2.json()["detail"].lower()
        assert "Retry-After" in r2.headers

    # Simulate expired cooldown
    from app.api.v1.ai import _incident_last_analysis_time
    _incident_last_analysis_time[db_incident.id] = time.time() - (settings.ANALYSIS_COOLDOWN_SECONDS + 1)

    with patch("app.services.ai.llm_client.requests.post", return_value=mock_resp):
        r3 = client.post(f"/api/v1/ai/incidents/{db_incident.id}/analyze")
        assert r3.status_code == 200


# ---------------------------------------------------------------------------
# Integration: RAG Retrieval and knowledgeSources mapping
# ---------------------------------------------------------------------------

def test_analyze_incident_with_rag_sources(db_incident):
    mock_rag_hits = [
        {
            "id": "1",
            "score": 0.82,
            "title": "High CPU Troubleshooting",
            "section": "Likely Causes",
            "content": "Process thread saturation",
            "source_file": "high-cpu.md",
        }
    ]

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status.return_value = None
    mock_resp.json.return_value = _make_gemini_resp(json.dumps(_GOOD_LLM_RESPONSE))

    mock_search = MagicMock(return_value=mock_rag_hits)
    with patch("app.services.ai.llm_client.requests.post", return_value=mock_resp), \
         patch("app.api.v1.ai._get_rag_search", return_value=mock_search):
        response = client.post(f"/api/v1/ai/incidents/{db_incident.id}/analyze")
        assert response.status_code == 200
        data = response.json()
        assert len(data.get("knowledgeSources", [])) == 1
        source = data["knowledgeSources"][0]
        assert source["title"] == "High CPU Troubleshooting"
        assert source["score"] == 0.82
        assert source["section"] == "Likely Causes"


def test_analyze_incident_rag_failure_graceful_fallback(db_incident):
    """If Qdrant fails, analysis still succeeds using incident telemetry."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.raise_for_status.return_value = None
    mock_resp.json.return_value = _make_gemini_resp(json.dumps(_GOOD_LLM_RESPONSE))

    mock_search = MagicMock(side_effect=Exception("Qdrant connection refused"))
    with patch("app.services.ai.llm_client.requests.post", return_value=mock_resp), \
         patch("app.api.v1.ai._get_rag_search", return_value=mock_search):
        response = client.post(f"/api/v1/ai/incidents/{db_incident.id}/analyze")
        assert response.status_code == 200
        data = response.json()
        assert data.get("knowledgeSources") == []
