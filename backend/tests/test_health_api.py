import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

def test_system_health_success():
    mock_targets = [
        {
            "job": "workload-generator",
            "instance": "workload-generator:8080",
            "health": "up",
            "last_scrape": "2026-10-12T10:00:00Z",
            "last_error": "",
        }
    ]
    with patch("app.api.v1.health.check_prometheus_health", return_value=True), \
         patch("app.api.v1.health.get_prometheus_targets", return_value=mock_targets):
        response = client.get("/api/v1/system/health")
        assert response.status_code == 200
        data = response.json()
        assert data["db"] in ("ok", "error")
        assert data["prometheus"] == "ok"
        assert len(data["prometheus_targets"]) == 1
        assert data["prometheus_targets"][0]["job"] == "workload-generator"
        assert data["prometheus_targets"][0]["health"] == "up"

def test_system_health_prometheus_down():
    with patch("app.api.v1.health.check_prometheus_health", return_value=False):
        response = client.get("/api/v1/system/health")
        assert response.status_code == 200
        data = response.json()
        assert data["prometheus"] == "error"
        assert data["prometheus_targets"] == []
