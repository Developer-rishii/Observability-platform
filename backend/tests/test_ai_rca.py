"""
Tests for the LLM client and the /incidents/{id}/analyze endpoint.
All outbound HTTP calls are mocked so no real API key is needed.
"""
import json
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.incident import Incident
from app.services.ai.llm_client import call_llm, LLMUnavailableError
from app.services.ai.prompt_builder import build_prompt
from app.services.correlation.incident_context import build_incident_context

client = TestClient(app)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_GOOD_LLM_RESPONSE = {
    "summary": "CPU usage spiked above threshold.",
    "probable_cause": "A workload spike caused excessive CPU consumption.",
    "confidence": "high",
    "next_steps": ["Check process list", "Scale horizontally", "Review alert thresholds"],
}


def _make_gemini_resp(text: str):
    """Build a minimal fake Gemini API JSON response."""
    return {
        "candidates": [
            {"content": {"parts": [{"text": text}]}}
        ]
    }


# ---------------------------------------------------------------------------
# Unit: build_incident_context
# ---------------------------------------------------------------------------

@pytest.fixture
def fake_incident():
    inc = Incident(
        id=42,
        title="High CPU",
        metric_name="cpu",
        metric_value=92.5,
        threshold=80.0,
        severity="critical",
        status="open",
        affected_metrics=["cpu"],
        detected_at=datetime.utcnow(),
    )
    return inc


def test_build_incident_context(fake_incident):
    ctx = build_incident_context(fake_incident)
    assert ctx["incident_id"] == 42
    assert ctx["metric_name"] == "cpu"
    assert ctx["metric_value"] == 92.5
    assert ctx["threshold"] == 80.0
    assert ctx["affected_service"] == "workload-generator"  # default


def test_build_prompt_contains_key_info(fake_incident):
    ctx = build_incident_context(fake_incident)
    prompt = build_prompt(ctx)
    assert "cpu" in prompt
    assert "92.5" in prompt
    assert "80.0" in prompt
    assert "JSON" in prompt


# ---------------------------------------------------------------------------
# Unit: call_llm
# ---------------------------------------------------------------------------

def test_call_llm_success():
    mock_response = MagicMock()
    mock_response.raise_for_status.return_value = None
    mock_response.json.return_value = _make_gemini_resp(json.dumps(_GOOD_LLM_RESPONSE))

    with patch("app.services.ai.llm_client.requests.post", return_value=mock_response):
        result = call_llm("test prompt")

    assert result["confidence"] == "high"
    assert len(result["next_steps"]) == 3


def test_call_llm_strips_markdown_fences():
    fenced = f"```json\n{json.dumps(_GOOD_LLM_RESPONSE)}\n```"
    mock_response = MagicMock()
    mock_response.raise_for_status.return_value = None
    mock_response.json.return_value = _make_gemini_resp(fenced)

    with patch("app.services.ai.llm_client.requests.post", return_value=mock_response):
        result = call_llm("test prompt")

    assert result["summary"] == _GOOD_LLM_RESPONSE["summary"]


def test_call_llm_raises_on_network_error():
    import requests as req
    with patch(
        "app.services.ai.llm_client.requests.post",
        side_effect=req.ConnectionError("network down"),
    ), patch("app.services.ai.llm_client.time.sleep"):  # speed up retry
        with pytest.raises(LLMUnavailableError):
            call_llm("test prompt")


# ---------------------------------------------------------------------------
# Integration: POST /incidents/{id}/analyze
# ---------------------------------------------------------------------------

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
        title="CPU Spike for RCA",
        metric_name="cpu",
        metric_value=95.0,
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
    db.delete(inc)
    db.commit()


def test_analyze_incident_success(db_incident):
    mock_response = MagicMock()
    mock_response.raise_for_status.return_value = None
    mock_response.json.return_value = _make_gemini_resp(json.dumps(_GOOD_LLM_RESPONSE))

    with patch("app.services.ai.llm_client.requests.post", return_value=mock_response):
        response = client.post(f"/api/v1/ai/incidents/{db_incident.id}/analyze")

    assert response.status_code == 200
    data = response.json()
    assert data["summary"] == _GOOD_LLM_RESPONSE["summary"]
    assert data["confidence"] == "high"
    assert isinstance(data["nextSteps"], list)


def test_analyze_incident_not_found():
    response = client.post("/api/v1/ai/incidents/999999/analyze")
    assert response.status_code == 404


def test_analyze_incident_llm_unavailable(db_incident):
    import requests as req
    with patch(
        "app.services.ai.llm_client.requests.post",
        side_effect=req.ConnectionError("network down"),
    ), patch("app.services.ai.llm_client.time.sleep"):
        response = client.post(f"/api/v1/ai/incidents/{db_incident.id}/analyze")

    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()
