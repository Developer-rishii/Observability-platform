import pytest
import uuid
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings

client = TestClient(app)

def test_events_ingest_missing_token():
    payload = {
        "client_event_id": str(uuid.uuid4()),
        "event_type": "container.die",
        "source": "docker",
        "severity": "critical",
        "container_name": "demo-app",
        "message": "Container demo-app died with exit code 137"
    }
    response = client.post("/api/v1/events/ingest", json=payload)
    assert response.status_code == 401
    assert "Invalid or missing X-Agent-Token" in response.json()["detail"]

def test_events_ingest_invalid_token():
    payload = {
        "client_event_id": str(uuid.uuid4()),
        "event_type": "container.die",
        "source": "docker",
        "severity": "critical",
        "container_name": "demo-app",
        "message": "Container demo-app died with exit code 137"
    }
    response = client.post(
        "/api/v1/events/ingest",
        json=payload,
        headers={"X-Agent-Token": "incorrect-token-value"}
    )
    assert response.status_code == 401
    assert "Invalid or missing X-Agent-Token" in response.json()["detail"]

def test_events_ingest_valid_token_and_idempotency():
    client_event_id = f"test-evt-{uuid.uuid4()}"
    payload = {
        "client_event_id": client_event_id,
        "event_type": "container.die",
        "source": "docker",
        "severity": "critical",
        "container_name": "demo-app",
        "message": "Container demo-app died with exit code 137",
        "metadata": {"exit_code": 137}
    }
    headers = {"X-Agent-Token": settings.AGENT_SHARED_SECRET}

    # First ingestion
    response = client.post("/api/v1/events/ingest", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "created"
    assert data["deduplicated"] is False
    assert isinstance(data["event_id"], int)
    event_id = data["event_id"]

    # Duplicate ingestion with same client_event_id
    dup_response = client.post("/api/v1/events/ingest", json=payload, headers=headers)
    assert dup_response.status_code == 201
    dup_data = dup_response.json()
    assert dup_data["status"] == "accepted"
    assert dup_data["deduplicated"] is True
    assert dup_data["event_id"] == event_id
