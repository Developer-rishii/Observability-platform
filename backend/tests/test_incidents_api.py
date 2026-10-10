import pytest
from fastapi.testclient import TestClient
from datetime import datetime

from app.main import app
from app.core.database import SessionLocal
from app.models.incident import Incident

client = TestClient(app)

@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def setup_incidents(db):
    inc1 = Incident(
        title="CPU Spike",
        metric_name="cpu",
        metric_value=85.5,
        threshold=80.0,
        severity="critical",
        status="open",
        affected_metrics=["cpu"],
        detected_at=datetime.utcnow()
    )
    inc2 = Incident(
        title="Memory Leak",
        metric_name="memory",
        metric_value=90.0,
        threshold=85.0,
        severity="high",
        status="resolved",
        affected_metrics=["memory"],
        detected_at=datetime.utcnow()
    )
    db.add(inc1)
    db.add(inc2)
    db.commit()
    db.refresh(inc1)
    db.refresh(inc2)
    
    yield {"open": inc1, "resolved": inc2}
    
    db.delete(inc1)
    db.delete(inc2)
    db.commit()

def test_list_incidents(setup_incidents):
    response = client.get("/api/v1/incidents/")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    # At least the 2 we created
    assert len(data["items"]) >= 2

def test_list_incidents_filter_open(setup_incidents):
    response = client.get("/api/v1/incidents/?status=open")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    # Check that all returned are open
    for inc in data["items"]:
        assert inc["status"] == "open"

def test_get_incident(setup_incidents):
    incident_id = setup_incidents["open"].id
    response = client.get(f"/api/v1/incidents/{incident_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == incident_id
    assert data["metricName"] == "cpu"
    assert data["metricValue"] == 85.5
    assert data["threshold"] == 80.0

def test_get_incident_not_found():
    response = client.get("/api/v1/incidents/999999")
    assert response.status_code == 404
