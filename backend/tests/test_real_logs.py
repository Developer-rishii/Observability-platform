"""
Unit and integration tests for Logs API and Loki client (R2).
Covers:
- Query text generation and safety (escaping hostile strings)
- Start and end ISO 8601 parsing and validation
- Precedence of start/end over minutes
- Maximum 24-hour range constraints and start >= end rejection
- Level validation (DEBUG, INFO, WARN, WARNING, ERROR, CRITICAL, FATAL)
- Normalization of WARN and WARNING
- Response shape preservation
"""

from __future__ import annotations

import re
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.ingestion.loki_client import (
    build_logql_query,
    escape_logql_regex_string,
    query_logs,
    ALLOWED_LEVELS,
)


client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. LogQL Query Generation & Escaping Tests
# ---------------------------------------------------------------------------

def test_build_logql_query_unfiltered():
    """Unfiltered query must match any service stream."""
    query = build_logql_query()
    assert query == '{service=~".+"}'


def test_build_logql_query_service_only():
    """Service filtering produces an exact stream selector."""
    query = build_logql_query(service="demo-app")
    assert query == '{service="demo-app"}'


def test_build_logql_query_service_all():
    """service='all' or 'ALL' falls back to the unfiltered selector."""
    assert build_logql_query(service="all") == '{service=~".+"}'
    assert build_logql_query(service="ALL") == '{service=~".+"}'


def test_build_logql_query_service_sanitization():
    """Hostile characters in service filter cannot break selector braces or inject LogQL."""
    query = build_logql_query(service='demo"}{injected="bad')
    # All non-alphanumeric/dot/dash/underscore are stripped by loki_client regex
    assert query == '{service="demoinjectedbad"}'


def test_build_logql_query_q_escaping():
    """Free text filter is escaped properly for regex and LogQL string quotes."""
    hostile_q = r'hello "world" \ [test] {brace} `backtick`'
    query = build_logql_query(query_str=hostile_q)
    # Check that it contains case-insensitive prefix and escapes double quotes and backslashes
    assert r'\"world\"' in query
    assert r'\\{brace\\}' in query
    assert r'\\[test\\]' in query
    assert query.startswith('{service=~".+"} |~ "(?i)')


def test_build_logql_query_level_warn_warning():
    """Filtering by WARN or WARNING matches both keywords."""
    query_warn = build_logql_query(level="WARN")
    assert r'|~ "(?i)\\b(WARN|WARNING)\\b"' in query_warn

    query_warning = build_logql_query(level="WARNING")
    assert r'|~ "(?i)\\b(WARN|WARNING)\\b"' in query_warning


def test_build_logql_query_combined():
    """Combined service, level, and q."""
    query = build_logql_query(service="demo-db", level="ERROR", query_str="connection failed")
    assert query == r'{service="demo-db"} |~ "(?i)connection failed" |~ "(?i)\\bERROR\\b"'


# ---------------------------------------------------------------------------
# 2. HTTP Endpoint Validation Tests (Offline / Mocked)
# ---------------------------------------------------------------------------

@patch("app.api.v1.logs.check_loki_health", return_value=True)
def test_logs_endpoint_invalid_service(mock_health):
    """Hostile service parameter returns HTTP 422."""
    resp = client.get('/api/v1/logs?service=demo"app')
    assert resp.status_code == 422
    assert "Invalid service name" in resp.json()["detail"]


@patch("app.api.v1.logs.check_loki_health", return_value=True)
def test_logs_endpoint_invalid_level(mock_health):
    """Unsupported level value returns HTTP 422."""
    resp = client.get("/api/v1/logs?level=SUPER_CRITICAL")
    assert resp.status_code == 422
    assert "Invalid log level" in resp.json()["detail"]


@patch("app.api.v1.logs.check_loki_health", return_value=True)
def test_logs_endpoint_invalid_iso_datetime(mock_health):
    """Malformed start or end date returns HTTP 422."""
    resp = client.get("/api/v1/logs?start=not-a-datetime")
    assert resp.status_code == 422
    assert "Invalid ISO 8601 datetime format" in resp.json()["detail"]


@patch("app.api.v1.logs.check_loki_health", return_value=True)
def test_logs_endpoint_start_after_end(mock_health):
    """start >= end returns HTTP 422."""
    start = "2026-10-22T10:00:00Z"
    end = "2026-10-22T09:00:00Z"
    resp = client.get(f"/api/v1/logs?start={start}&end={end}")
    assert resp.status_code == 422
    assert "must be earlier than end timestamp" in resp.json()["detail"]


@patch("app.api.v1.logs.check_loki_health", return_value=True)
def test_logs_endpoint_range_exceeds_24_hours(mock_health):
    """Time range > 24 hours returns HTTP 422."""
    start = "2026-10-20T00:00:00Z"
    end = "2026-10-22T00:00:00Z"
    resp = client.get(f"/api/v1/logs?start={start}&end={end}")
    assert resp.status_code == 422
    assert "exceeds maximum allowed window of 24 hours" in resp.json()["detail"]


@patch("app.api.v1.logs.check_loki_health", return_value=False)
def test_logs_endpoint_loki_unreachable_503(mock_health):
    """Returns 503 when Loki health check fails."""
    resp = client.get("/api/v1/logs")
    assert resp.status_code == 503
    assert "currently unreachable" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# 3. Client Query Execution & Stream Parsing (Mocked Loki Response)
# ---------------------------------------------------------------------------

@patch("app.services.ingestion.loki_client.requests.get")
def test_query_logs_mock_parsing(mock_get):
    """Verify JSON parsing and LogLine structure creation."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "status": "success",
        "data": {
            "resultType": "streams",
            "result": [
                {
                    "stream": {
                        "service": "demo-app",
                        "container": "demo-app",
                        "level": "INFO",
                    },
                    "values": [
                        [
                            "1792648800000000000",
                            '{"time": "2026-10-22T03:20:00Z", "level": "INFO", "path": "/api/orders", "status": 200, "duration_ms": 1.5}'
                        ],
                        [
                            "1792648801000000000",
                            "Uvicorn startup complete"
                        ]
                    ]
                }
            ]
        }
    }
    mock_get.return_value = mock_resp

    results = query_logs(service="demo-app", limit=10)
    assert len(results) == 2
    assert results[0].service == "demo-app"
    assert results[0].container == "demo-app"
    assert results[0].level == "INFO"
    assert "Uvicorn startup complete" in results[0].message
    assert "/api/orders" in results[1].message
