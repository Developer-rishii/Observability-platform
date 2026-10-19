import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

def test_metrics_query_success():
    mock_data = [
        {"t": 1728900000, "v": 45.2},
        {"t": 1728900060, "v": 48.0},
    ]
    with patch("app.api.v1.metrics.query_range", return_value=mock_data):
        response = client.get("/api/v1/metrics/query?metric=cpu&range=5m")
        assert response.status_code == 200
        data = response.json()
        assert data["metric"] == "cpu"
        assert data["unit"] == "%"
        assert data["label"] == "Host CPU Utilization"
        assert len(data["points"]) == 2
        assert data["points"][0]["v"] == 45.2
        assert data["threshold"] is not None

def test_metrics_query_all_standard_metrics():
    with patch("app.api.v1.metrics.query_range", return_value=[]):
        for metric in ["cpu", "memory", "disk", "network", "custom_metric"]:
            response = client.get(f"/api/v1/metrics/query?metric={metric}&range=1h")
            assert response.status_code == 200
            data = response.json()
            assert data["metric"] == metric
            assert isinstance(data["points"], list)
