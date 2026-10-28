import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.ai import router as ai_router, _chat_rate_limits
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.incident import Incident
from app.models.models import User, AIAnalysis
from app.models.event import Event
from app.services.ai.openai_chat import (
    ChatProvider,
    OpenAIChatDisabledError,
    OpenAIChatAuthError,
    OpenAIChatRateLimitError,
    OpenAIChatTimeoutError,
)
from app.services.ai.chat_context_builder import redact_sensitive_text, build_chat_context


# ---------------------------------------------------------------------------
# Test Fixtures & App Setup
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clear_rate_limits():
    _chat_rate_limits.clear()


@pytest.fixture
def mock_db():
    return MagicMock(spec=Session)


@pytest.fixture
def mock_user():
    return User(id=42, email="sre@example.com", is_active=True, is_admin=False)


@pytest.fixture
def fake_ml_incident():
    return Incident(
        id=356,
        title="High Anomaly: Latency Spike (P95 Variance)",
        severity="high",
        status="resolved",
        affected_service="demo-app",
        detection_source="ml",
        metric_name="anomaly_score",
        metric_value=0.7789,
        threshold=0.7287,
        anomaly_score=0.7789,
        detected_at=datetime(2026, 10, 28, 10, 15, 58),
        resolved_at=datetime(2026, 10, 28, 10, 22, 28),
        affected_metrics=["latency_p95_std_5m", "latency_p95_mean_5m", "request_rate_mean_5m"],
        description="ML Anomaly detected (score: 0.7789 >= threshold: 0.7287).",
    )


@pytest.fixture
def test_client(mock_db, mock_user):
    app = FastAPI()
    app.include_router(ai_router, prefix="/api/v1/ai")

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: mock_user

    return TestClient(app)


# ---------------------------------------------------------------------------
# Unit Tests: Redaction & Data Minimisation
# ---------------------------------------------------------------------------

def test_redact_sensitive_text():
    sample = (
        "User logged in with email john.doe@company.org. "
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisToken "
        "and api_key=sk-proj-abc12345678901234567890xyz and password: supersecret123! "
        "Connecting to postgresql://admin:p@ssw0rd123@db:5432/observability"
    )
    redacted = redact_sensitive_text(sample)

    assert "john.doe@company.org" not in redacted
    assert "[REDACTED_EMAIL]" in redacted
    assert "eyJhbGciOi" not in redacted
    assert "sk-proj-abc12345678901234567890xyz" not in redacted
    assert "supersecret123!" not in redacted
    assert "p@ssw0rd123" not in redacted
    assert "[REDACTED_PASS]" in redacted


# ---------------------------------------------------------------------------
# Unit Tests: Time-anchored Prometheus Queries
# ---------------------------------------------------------------------------

@patch("app.services.ingestion.prometheus_client.query_range")
def test_metric_trends_use_incident_window_not_now(mock_query_range, mock_db, fake_ml_incident):
    """Confirm query_range uses [detected_at - 12m, resolved_at] for historical incidents."""
    mock_query_range.return_value = [
        {"t": fake_ml_incident.detected_at - timedelta(minutes=5), "v": 0.05},
        {"t": fake_ml_incident.detected_at + timedelta(minutes=2), "v": 2.50},
    ]

    context, summary = build_chat_context(mock_db, fake_ml_incident)

    assert mock_query_range.called
    call_args = mock_query_range.call_args[1]
    expected_start = int((fake_ml_incident.detected_at - timedelta(minutes=12)).timestamp())
    expected_end = int(fake_ml_incident.resolved_at.timestamp())

    assert call_args["start_time"] == expected_start
    assert call_args["end_time"] == expected_end
    assert "METRIC TRENDS (2026-10-28 10:03:58 UTC to 2026-10-28 10:22:28 UTC" in context


# ---------------------------------------------------------------------------
# Unit Tests: Chat Endpoints (Mocked LLM)
# ---------------------------------------------------------------------------

@patch("app.api.v1.ai.get_chat_provider")
def test_chat_success_with_stored_analysis(mock_get_provider, test_client, mock_db, fake_ml_incident):
    mock_provider = MagicMock(spec=ChatProvider)
    mock_provider.is_configured.return_value = True
    mock_provider.generate.return_value = "The incident was triggered by a 2.5s spike in P95 latency."
    mock_get_provider.return_value = mock_provider

    mock_db.query.return_value.filter.return_value.first.return_value = fake_ml_incident
    # Query for stored RCA
    mock_analysis = AIAnalysis(
        incident_id=fake_ml_incident.id,
        confidence="medium",
        response_json={"summary": "High latency anomaly on demo-app.", "probable_cause": "Database connection pool timeout."},
    )
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = mock_analysis

    resp = test_client.post(
        f"/api/v1/ai/incidents/{fake_ml_incident.id}/chat",
        json={"message": "Why was this incident flagged?"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert "P95 latency" in data["answer"]
    assert data["usedAnalysis"] is True
    assert "incident" in data["contextSummary"]


@patch("app.api.v1.ai.get_chat_provider")
def test_chat_status_configured(mock_get_provider, test_client):
    mock_provider = MagicMock(spec=ChatProvider)
    mock_provider.is_configured.return_value = True
    mock_get_provider.return_value = mock_provider

    resp = test_client.get("/api/v1/ai/chat/status")
    assert resp.status_code == 200
    assert resp.json()["configured"] is True


def test_chat_status_unauthenticated():
    """Verify 401 without auth token."""
    unauthed_client = TestClient(FastAPI().include_router(ai_router, prefix="/api/v1/ai"))
    resp = unauthed_client.get("/api/v1/ai/chat/status")
    assert resp.status_code == 401


@patch("app.api.v1.ai.get_chat_provider")
def test_chat_disabled_mode(mock_get_provider, test_client, fake_ml_incident, mock_db):
    mock_provider = MagicMock(spec=ChatProvider)
    mock_provider.is_configured.return_value = False
    mock_get_provider.return_value = mock_provider

    resp = test_client.post(
        f"/api/v1/ai/incidents/{fake_ml_incident.id}/chat",
        json={"message": "What caused this?"},
    )
    assert resp.status_code == 503
    assert "disabled or not configured" in resp.json()["detail"]


@patch("app.api.v1.ai.get_chat_provider")
def test_chat_auth_error_from_provider(mock_get_provider, test_client, fake_ml_incident, mock_db):
    mock_provider = MagicMock(spec=ChatProvider)
    mock_provider.is_configured.return_value = True
    mock_provider.generate.side_effect = OpenAIChatAuthError("AI chat is not configured.")
    mock_get_provider.return_value = mock_provider

    mock_db.query.return_value.filter.return_value.first.return_value = fake_ml_incident

    resp = test_client.post(
        f"/api/v1/ai/incidents/{fake_ml_incident.id}/chat",
        json={"message": "What is happening?"},
    )
    assert resp.status_code == 503
    assert "AI chat is not configured" in resp.json()["detail"]


@patch("app.api.v1.ai.get_chat_provider")
def test_chat_rate_limiting_enforced(mock_get_provider, test_client, fake_ml_incident, mock_db):
    mock_provider = MagicMock(spec=ChatProvider)
    mock_provider.is_configured.return_value = True
    mock_provider.generate.return_value = "Response 1"
    mock_get_provider.return_value = mock_provider

    mock_db.query.return_value.filter.return_value.first.return_value = fake_ml_incident

    # First call succeeds
    resp1 = test_client.post(
        f"/api/v1/ai/incidents/{fake_ml_incident.id}/chat",
        json={"message": "First message"},
    )
    assert resp1.status_code == 200

    # Immediate second call within 2 seconds fails with 429
    resp2 = test_client.post(
        f"/api/v1/ai/incidents/{fake_ml_incident.id}/chat",
        json={"message": "Immediate second message"},
    )
    assert resp2.status_code == 429
    assert "wait at least 2 seconds" in resp2.json()["detail"]


def test_chat_message_length_limit(test_client, fake_ml_incident, mock_db):
    long_msg = "A" * 501
    resp = test_client.post(
        f"/api/v1/ai/incidents/{fake_ml_incident.id}/chat",
        json={"message": long_msg},
    )
    assert resp.status_code == 400
    assert "exceeds maximum allowed length of 500" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Unit Tests: Failure Isolation (Dependencies Down)
# ---------------------------------------------------------------------------

@patch("app.services.ingestion.prometheus_client.query_range", side_effect=Exception("Prometheus unreachable"))
@patch("app.services.ai.chat_context_builder.collect_incident_logs", return_value=([], "Loki connection timeout"))
def test_failure_isolation_prom_and_loki_down(mock_logs, mock_prom, mock_db, fake_ml_incident):
    """When Prometheus and Loki fail, context building does not crash and marks them unavailable."""
    context, summary = build_chat_context(mock_db, fake_ml_incident)

    assert "Prometheus unavailable" in context
    assert "logs unavailable" in summary or "0 log lines" in summary
    assert "INCIDENT OVERVIEW" in context
