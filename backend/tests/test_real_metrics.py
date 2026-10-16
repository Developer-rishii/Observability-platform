import pytest
from datetime import datetime
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.services.ingestion.prometheus_client import (
    _get_query_for_metric,
    PrometheusUnavailableException,
)

client = TestClient(app)

def test_query_mapping_all_metrics():
    # Node exporter metrics
    assert "mode=\"idle\"" in _get_query_for_metric("cpu")
    assert "node_memory_MemAvailable_bytes" in _get_query_for_metric("memory")
    assert "mountpoint=\"/rootfs\"" in _get_query_for_metric("disk")
    assert "node_network_receive_bytes_total" in _get_query_for_metric("network")
    assert "node_time_seconds" in _get_query_for_metric("uptime")
    assert "node_load1" in _get_query_for_metric("load")
    
    # Demo app and process metrics
    assert "http_requests_total" in _get_query_for_metric("request_rate")
    assert "http_request_duration_seconds_bucket" in _get_query_for_metric("p95_latency")
    assert "histogram_quantile(0.95" in _get_query_for_metric("p95_latency")
    assert "status=~\"5..\"" in _get_query_for_metric("error_rate")
    assert _get_query_for_metric("demo_data_dir_bytes") == "demo_data_dir_bytes"
    assert "process_cpu_seconds_total" in _get_query_for_metric("demo_app_cpu")
    assert "process_resident_memory_bytes" in _get_query_for_metric("demo_app_memory")

def test_metrics_empty_list_on_no_data():
    with patch("app.api.v1.metrics.query_range", return_value=[]):
        response = client.get("/api/v1/metrics/query?metric=demo_app_cpu&range=5m")
        assert response.status_code == 200
        data = response.json()
        assert data["metric"] == "demo_app_cpu"
        assert data["unit"] == "%"
        assert data["label"] == "Demo App Process CPU"
        assert data["points"] == []

def test_metrics_503_when_prometheus_down():
    with patch("app.api.v1.metrics.query_range", side_effect=PrometheusUnavailableException("Connection refused")):
        response = client.get("/api/v1/metrics/query?metric=cpu&range=5m")
        assert response.status_code == 503
        data = response.json()
        assert data["code"] == "prometheus_unavailable"
        assert "Prometheus server unavailable" in data["detail"]

def test_servers_container_count_null_when_no_data():
    with patch("app.services.ingestion.prometheus_client.check_health", return_value=True), \
         patch("app.services.ingestion.prometheus_client.query_instant") as mock_instant:
        def side_effect(metric):
            if metric == "cpu":
                return 15.0
            if metric == "container_count":
                return None
            return 10.0
        mock_instant.side_effect = side_effect

        response = client.get("/api/v1/servers")
        assert response.status_code == 200
        servers = response.json()
        assert len(servers) > 0
        assert servers[0]["hostname"] == "docker-desktop-vm"
        # FastAPI camelCase alias generator serializes container_count as containerCount
        val = servers[0].get("containerCount", servers[0].get("container_count"))
        assert val is None
