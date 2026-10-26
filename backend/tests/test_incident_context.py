"""
Tests for incident context, evidence correlation, and acceptance scenarios (S3).
"""
import json
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.incident import Incident
from app.models.models import Event
from app.schemas import LogLine, DockerEvent
from app.services.correlation.incident_context import (
    build_incident_context,
    get_incident_time_window,
    collect_incident_logs,
    collect_docker_events,
    get_incident_evidence,
    SERVICE_DEPENDENCIES,
)

client = TestClient(app)

CANDIDATE_FIXTURE_DIRS = [
    os.environ.get("FIXTURES_DIR"),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "tests", "fixtures")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures")),
    os.path.abspath(os.path.join(os.getcwd(), "tests", "fixtures")),
    os.path.abspath(os.path.join(os.getcwd(), "..", "tests", "fixtures")),
    "/tests/fixtures",
]


def _load_fixture(filename: str):
    for dir_candidate in CANDIDATE_FIXTURE_DIRS:
        if dir_candidate and os.path.isdir(dir_candidate):
            candidate_file = os.path.join(dir_candidate, filename)
            if os.path.isfile(candidate_file):
                with open(candidate_file, "r", encoding="utf-8") as f:
                    return json.load(f)

    # Fallback to embedded canonical fixture data matching tests/fixtures/*.json
    # for environments where the repository root tests/ folder is not bind-mounted (e.g. backend container)
    if filename == "loki_connection_refused_logs.json":
        return [
            {
                "id": "log-001",
                "timestamp": "2026-10-16T14:45:10Z",
                "level": "ERROR",
                "service": "demo-app",
                "container": "demo-app",
                "message": 'sqlalchemy.exc.OperationalError: (psycopg2.OperationalError) connection to server at "demo-db" (172.18.0.2), port 5432 failed: Connection refused',
            },
            {
                "id": "log-002",
                "timestamp": "2026-10-16T14:46:00Z",
                "level": "WARN",
                "service": "demo-app",
                "container": "demo-app",
                "message": "Database pool degraded: retrying connection refused after backoff",
            },
        ]
    elif filename == "docker_demo_db_stop_events.json":
        return [
            {
                "id": 501,
                "event_type": "container.stop",
                "source": "docker",
                "severity": "warning",
                "timestamp": "2026-10-16T14:45:00Z",
                "payload": {
                    "container_name": "demo-db",
                    "service": "demo-db",
                    "action": "stop",
                    "message": "container.stop on demo-db",
                },
            },
            {
                "id": 502,
                "event_type": "container.die",
                "source": "docker",
                "severity": "critical",
                "timestamp": "2026-10-16T14:45:02Z",
                "payload": {
                    "container_name": "demo-db",
                    "service": "demo-db",
                    "action": "die",
                    "exit_code": 0,
                    "message": "container.die on demo-db",
                },
            },
        ]

    raise FileNotFoundError(f"Fixture file not found: {filename}")


def test_get_incident_time_window():
    """Verify ±5-minute window calculation anchored to incident.detected_at."""
    dt = datetime(2026, 10, 16, 14, 45, 0)
    start_dt, end_dt = get_incident_time_window(dt, window_minutes=5)
    assert start_dt == datetime(2026, 10, 16, 14, 40, 0)
    assert end_dt == datetime(2026, 10, 16, 14, 50, 0)


def test_collect_incident_logs_filtering():
    """Verify error and warning logs are retrieved and filtered."""
    raw_logs = _load_fixture("loki_connection_refused_logs.json")
    mock_log_lines = [
        LogLine(
            id=item["id"],
            timestamp=datetime.fromisoformat(item["timestamp"].replace("Z", "+00:00")),
            level=item["level"],
            service=item["service"],
            container=item.get("container"),
            message=item["message"],
        )
        for item in raw_logs
    ]
    # Add an info log that should be filtered out
    mock_log_lines.append(
        LogLine(
            id="log-info",
            timestamp=datetime.utcnow(),
            level="INFO",
            service="demo-app",
            message="Heartbeat ok",
        )
    )

    with patch("app.services.correlation.incident_context.query_logs", return_value=mock_log_lines):
        logs, note = collect_incident_logs(
            service="demo-app",
            start_dt=datetime(2026, 10, 16, 14, 40, 0),
            end_dt=datetime(2026, 10, 16, 14, 50, 0),
        )
        assert note is None
        assert len(logs) == 2
        assert all(l.level in ("ERROR", "WARN") for l in logs)
        assert "connection refused" in logs[0].message.lower()


def test_collect_incident_logs_alias_fallback():
    """Verify collect_incident_logs checks known compose aliases (e.g. workload-generator for demo-app)."""
    mock_log_lines = [
        LogLine(
            id="log-alias-1",
            timestamp=datetime(2026, 10, 16, 14, 45, 0, tzinfo=timezone.utc),
            level="ERROR",
            service="workload-generator",
            container="demo-app",
            message="connection refused",
        )
    ]

    def mock_query(service=None, **kwargs):
        if service == "demo-app":
            return []
        if service == "workload-generator":
            return mock_log_lines
        return []

    with patch("app.services.correlation.incident_context.query_logs", side_effect=mock_query):
        logs, note = collect_incident_logs(
            service="demo-app",
            start_dt=datetime(2026, 10, 16, 14, 40, 0),
            end_dt=datetime(2026, 10, 16, 14, 50, 0),
        )
        assert note is None
        assert len(logs) == 1
        assert logs[0].service == "workload-generator"
        assert "connection refused" in logs[0].message


def test_collect_incident_logs_loki_failure_graceful_note():
    """Verify missing/unavailable Loki logs return empty list and source note without crashing."""
    with patch(
        "app.services.correlation.incident_context.query_logs",
        side_effect=Exception("Loki connection timeout"),
    ):
        logs, note = collect_incident_logs(
            service="demo-app",
            start_dt=datetime.utcnow(),
            end_dt=datetime.utcnow(),
        )
        assert logs == []
        assert note is not None
        assert "Loki log source unavailable" in note


def test_collect_docker_events_with_dependencies_and_payload_container_name():
    """Verify Docker event collection filters payload->>'container_name' for affected service and its dependency."""
    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_filter = MagicMock()
    mock_order = MagicMock()

    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_filter
    mock_filter.order_by.return_value = mock_order

    events_fixture = _load_fixture("docker_demo_db_stop_events.json")

    # Row 1: demo-db stop event (dependency)
    ev1 = Event(
        id=events_fixture[0]["id"],
        event_type=events_fixture[0]["event_type"],
        source=events_fixture[0]["source"],
        severity=events_fixture[0]["severity"],
        timestamp=datetime(2026, 10, 16, 14, 45, 0),
        payload=events_fixture[0]["payload"],
    )
    # Row 2: demo-db die event (dependency)
    ev2 = Event(
        id=events_fixture[1]["id"],
        event_type=events_fixture[1]["event_type"],
        source=events_fixture[1]["source"],
        severity=events_fixture[1]["severity"],
        timestamp=datetime(2026, 10, 16, 14, 45, 2),
        payload=events_fixture[1]["payload"],
    )
    # Row 3: unrelated container event
    ev3 = Event(
        id=999,
        event_type="container.start",
        source="docker",
        severity="info",
        timestamp=datetime(2026, 10, 16, 14, 45, 10),
        payload={"container_name": "unrelated-redis", "service": "redis"},
    )

    mock_order.limit.return_value.all.return_value = [ev1, ev2, ev3]

    events, note = collect_docker_events(
        db=mock_db,
        affected_service="demo-app",
        start_dt=datetime(2026, 10, 16, 14, 40, 0),
        end_dt=datetime(2026, 10, 16, 14, 50, 0),
    )

    assert note is None
    assert len(events) == 2
    # Check that demo-db stop and die events are preserved
    assert events[0].container_name == "demo-db"
    assert events[0].event_type == "container.stop"
    assert events[1].container_name == "demo-db"
    assert events[1].event_type == "container.die"


def test_collect_docker_events_failure_graceful_note():
    """Verify DB failure during Docker event query returns empty list and note without raising."""
    mock_db = MagicMock()
    mock_db.query.side_effect = Exception("DB connection dropped")

    events, note = collect_docker_events(
        db=mock_db,
        affected_service="demo-app",
        start_dt=datetime.utcnow(),
        end_dt=datetime.utcnow(),
    )
    assert events == []
    assert note is not None
    assert "Docker event source unavailable" in note


def test_s3_acceptance_stop_the_database_incident_evidence():
    """
    Acceptance criterion:
    A 'stop the database' incident shows:
      1. 'connection refused' logs for demo-app.
      2. A stop event for demo-db.
      3. Incident detail response contains logs, events, and source_notes.
    """
    incident = Incident(
        id=77,
        title="Database Down Error Spike",
        metric_name="error_rate",
        metric_value=45.0,
        threshold=5.0,
        severity="critical",
        status="open",
        affected_service="demo-app",
        detected_at=datetime(2026, 10, 16, 14, 45, 0),
        affected_metrics=["error_rate"],
    )

    # Load real fixtures
    raw_logs = _load_fixture("loki_connection_refused_logs.json")
    mock_logs = [
        LogLine(
            id=item["id"],
            timestamp=datetime.fromisoformat(item["timestamp"].replace("Z", "+00:00")),
            level=item["level"],
            service=item["service"],
            container=item.get("container"),
            message=item["message"],
        )
        for item in raw_logs
    ]

    events_fixture = _load_fixture("docker_demo_db_stop_events.json")
    mock_event_rows = [
        Event(
            id=item["id"],
            event_type=item["event_type"],
            source=item["source"],
            severity=item["severity"],
            timestamp=datetime.fromisoformat(item["timestamp"].replace("Z", "+00:00")),
            payload=item["payload"],
        )
        for item in events_fixture
    ]

    from app.core.database import get_db

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = incident
    mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = mock_event_rows

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        with patch("app.services.correlation.incident_context.query_logs", return_value=mock_logs):
            response = client.get(f"/api/v1/incidents/{incident.id}")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    data = response.json()

    assert data["id"] == 77
    assert data["affectedService"] == "demo-app"

    # Verify logs evidence
    assert len(data["logs"]) >= 1
    has_conn_refused = any("connection refused" in l["message"].lower() for l in data["logs"])
    assert has_conn_refused is True

    # Verify Docker events evidence
    assert len(data["events"]) >= 1
    has_db_stop = any(
        e["containerName"] == "demo-db" and e["eventType"] == "container.stop"
        for e in data["events"]
    )
    assert has_db_stop is True

    # Verify source_notes field exists and is a list
    assert "sourceNotes" in data
    assert isinstance(data["sourceNotes"], list)


def test_build_incident_context_backwards_compatible():
    """Verify build_incident_context remains 100% backwards-compatible for AI RCA callers."""
    inc = Incident(
        id=99,
        title="High CPU",
        metric_name="cpu",
        metric_value=95.0,
        threshold=80.0,
        severity="critical",
        status="open",
        affected_service="demo-app",
        detected_at=datetime(2026, 10, 16, 14, 45, 0),
        affected_metrics=["cpu"],
    )
    ctx = build_incident_context(inc)
    assert ctx["incident_id"] == 99
    assert ctx["metric_name"] == "cpu"
    assert ctx["affected_service"] == "demo-app"
    assert ctx["detected_at"] == inc.detected_at.isoformat()


def test_loki_query_logs_utc_timestamp_portability():
    """Verify naive UTC datetimes produce exact UTC nanoseconds without host timezone offset shift."""
    from datetime import timezone
    from app.services.ingestion.loki_client import query_logs

    # 2026-10-16 14:40:00 UTC corresponds to exact epoch 1792161600
    naive_start = datetime(2026, 10, 16, 14, 40, 0)
    naive_end = datetime(2026, 10, 16, 14, 50, 0)

    aware_start = datetime(2026, 10, 16, 14, 40, 0, tzinfo=timezone.utc)
    aware_end = datetime(2026, 10, 16, 14, 50, 0, tzinfo=timezone.utc)

    captured_params = []

    def mock_requests_get(url, params=None, timeout=None):
        captured_params.append(params)
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"status": "success", "data": {"result": []}}
        return mock_resp

    with patch("requests.get", side_effect=mock_requests_get):
        # 1. Query with naive UTC datetimes
        query_logs(service="demo-app", start_dt=naive_start, end_dt=naive_end)
        # 2. Query with explicitly aware UTC datetimes
        query_logs(service="demo-app", start_dt=aware_start, end_dt=aware_end)

    assert len(captured_params) == 2
    naive_p, aware_p = captured_params[0], captured_params[1]

    # Expected nanoseconds for 2026-10-16 14:40:00 UTC = 1792161600 * 1e9
    expected_start_ns = 1792161600 * 1_000_000_000
    expected_end_ns = 1792162200 * 1_000_000_000

    assert naive_p["start"] == expected_start_ns
    assert naive_p["end"] == expected_end_ns

    # Naive and aware must match identically
    assert naive_p["start"] == aware_p["start"]
    assert naive_p["end"] == aware_p["end"]
