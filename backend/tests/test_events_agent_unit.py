"""
Unit tests for Docker Events Agent logic.
Validates:
- SHA-256 client_event_id determinism and exact 64-char length.
- Action mapping directly to container.<action>.
- Absence of synthetic container.restart.
- Rejection of missing/empty secret at startup.
- Forwarder deduplication handling (201 accepted).
"""

import hashlib
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

# Ensure repository root or /agent is in sys.path when running pytest from backend/
for _candidate in [
    Path(__file__).resolve().parent.parent.parent,  # Repo root (host or GitHub Actions runner)
    Path("/"),                                      # If mounted at root in container
    Path(__file__).resolve().parent.parent,         # backend/ directory
]:
    if (_candidate / "agent").is_dir() and str(_candidate) not in sys.path:
        sys.path.insert(0, str(_candidate))
        break

# Mock docker package if not installed in backend testing environment
if "docker" not in sys.modules:
    try:
        import docker
    except ImportError:
        sys.modules["docker"] = MagicMock()

from agent.main import (
    build_client_event_id,
    map_docker_event,
    validate_environment,
    EventForwarder,
)


def test_client_event_id_determinism_and_length():
    """Verify client_event_id is strictly 64 hex characters and deterministic."""
    container_id = "aeab312c542355cc90c44fbb9982b4f13ad509a99ef91ae6e23f284a1fbbae86"
    action = "die"
    timestamp_ns = 1729348920123456789

    id1 = build_client_event_id(container_id, action, timestamp_ns)
    id2 = build_client_event_id(container_id, action, timestamp_ns)

    assert len(id1) == 64
    assert id1 == id2
    assert id1 == hashlib.sha256(f"{container_id}:{action}:{timestamp_ns}".encode("utf-8")).hexdigest()

    # Different timestamp produces different id
    id3 = build_client_event_id(container_id, action, timestamp_ns + 1)
    assert id1 != id3
    assert len(id3) == 64


def test_map_docker_event_faithful_mapping():
    """Verify event mapping maps action faithfully without synthetic container.restart."""
    raw_event = {
        "Type": "container",
        "Action": "die",
        "Actor": {
            "ID": "1234567890abcdef" * 4,
            "Attributes": {
                "name": "demo-app",
                "com.docker.compose.service": "demo-app",
                "exitCode": "137",
                "image": "observability-platform-demo-app:latest",
            },
        },
        "time": 1729348920,
        "timeNano": 1729348920123456789,
    }

    mapped = map_docker_event(raw_event)
    assert mapped is not None
    assert mapped["event_type"] == "container.die"
    assert mapped["container_name"] == "demo-app"
    assert mapped["service"] == "demo-app"
    assert mapped["source"] == "docker"
    assert len(mapped["client_event_id"]) == 64
    assert mapped["metadata"]["exit_code"] == 137
    assert "137" in mapped["message"]

    # Verify action 'restart' produces 'container.restart'
    restart_raw = dict(raw_event, Action="restart")
    restart_mapped = map_docker_event(restart_raw)
    assert restart_mapped["event_type"] == "container.restart"

    # Verify action 'start' does NOT emit container.restart
    start_raw = dict(raw_event, Action="start")
    start_mapped = map_docker_event(start_raw)
    assert start_mapped["event_type"] == "container.start"


def test_validate_environment_missing_secret():
    """Verify startup fails with code 1 when AGENT_SHARED_SECRET is missing or empty."""
    with patch.dict(os.environ, {"AGENT_SHARED_SECRET": ""}, clear=True):
        with pytest.raises(SystemExit) as exc_info:
            validate_environment()
        assert exc_info.value.code == 1

    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(SystemExit) as exc_info:
            validate_environment()
        assert exc_info.value.code == 1


def test_forwarder_deduplication_success():
    """Verify forwarder treats HTTP 201 with deduplicated: True as success."""
    forwarder = EventForwarder("http://backend:8000/api/v1/events/ingest", "testtoken")

    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {"status": "accepted", "event_id": 42, "deduplicated": True}

    with patch.object(forwarder.session, "post", return_value=mock_response):
        success = forwarder.forward_or_enqueue({"event_type": "container.die", "container_name": "demo-app"})
        assert success is True
        assert len(forwarder.queue) == 0
