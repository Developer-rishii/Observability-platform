"""
Docker Events Forwarder Agent.
Streams container events from the local Docker daemon, extracts metadata,
builds deterministic idempotency keys, and forwards events to the Observability
Platform backend ingestion endpoint (POST /api/v1/events/ingest).
"""

from __future__ import annotations

import collections
import hashlib
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import docker
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("events-agent")

# Configuration via environment variables
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000").rstrip("/")
INGEST_ENDPOINT = f"{BACKEND_URL}/api/v1/events/ingest"
AGENT_SHARED_SECRET = os.getenv("AGENT_SHARED_SECRET")
QUEUE_CAPACITY = int(os.getenv("QUEUE_CAPACITY", "500"))
LABEL_FILTER = os.getenv("LABEL_FILTER", "monitor=true")


def validate_environment() -> str:
    """Validate critical environment variables on startup.
    Exits with code 1 if AGENT_SHARED_SECRET is missing or empty.
    Never prints or logs the secret.
    """
    if not AGENT_SHARED_SECRET or not AGENT_SHARED_SECRET.strip():
        logger.error("Startup failed: AGENT_SHARED_SECRET environment variable is missing or empty.")
        sys.exit(1)
    logger.info("Environment configuration validated successfully.")
    return AGENT_SHARED_SECRET.strip()


def build_client_event_id(container_id: str, action: str, timestamp_ns: int) -> str:
    """Build a deterministic, 64-character SHA-256 hex digest for event deduplication.
    Format: sha256(container_id:action:timestamp_ns)
    """
    raw_key = f"{container_id}:{action}:{timestamp_ns}".encode("utf-8")
    return hashlib.sha256(raw_key).hexdigest()


def map_docker_event(raw_event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Parse a Docker event dictionary into an EventIngestPayload dictionary.
    Returns None if event is not a container event.
    """
    event_type_str = raw_event.get("Type")
    if event_type_str != "container":
        return None

    action = raw_event.get("Action", "")
    # Docker actions can sometimes have attributes appended, e.g., 'exec_die: 0'
    base_action = action.split(":")[0].strip()

    actor = raw_event.get("Actor", {})
    container_id = actor.get("ID", "")
    attributes = actor.get("Attributes", {})

    # Extract container name (strip leading slash if present)
    container_name = attributes.get("name") or raw_event.get("id", "")[:12]
    if container_name.startswith("/"):
        container_name = container_name[1:]

    # Extract service name
    service = attributes.get("com.docker.compose.service") or container_name

    # Determine timestamp (Docker provides time in seconds and timeNano in nanoseconds)
    time_nano = raw_event.get("timeNano")
    if time_nano is not None:
        timestamp_sec = time_nano / 1_000_000_000.0
        time_int_for_id = int(time_nano)
    else:
        time_sec = raw_event.get("time", int(time.time()))
        timestamp_sec = float(time_sec)
        time_int_for_id = int(time_sec * 1_000_000_000)

    event_dt = datetime.fromtimestamp(timestamp_sec, tz=timezone.utc).isoformat()

    # Deterministic 64-char client_event_id
    client_event_id = build_client_event_id(container_id, base_action, time_int_for_id)

    # Standardize event_type faithfully as container.<action>
    event_type = f"container.{base_action}"

    # Construct human-readable message
    exit_code = attributes.get("exitCode")
    if exit_code is not None:
        message = f"Container {container_name} {base_action} (exit code: {exit_code})"
    else:
        message = f"Container {container_name} {base_action}"

    # Detailed metadata
    metadata = {
        "container_id": container_id,
        "image": attributes.get("image"),
        "exit_code": int(exit_code) if exit_code is not None and str(exit_code).isdigit() else None,
        "raw_attributes": attributes,
    }

    return {
        "client_event_id": client_event_id,
        "event_type": event_type,
        "source": "docker",
        "service": service,
        "container_name": container_name,
        "message": message,
        "timestamp": event_dt,
        "metadata": metadata,
    }


class EventForwarder:
    """Manages event dispatching, bounded retry queue, and backoff handling."""

    def __init__(self, endpoint: str, token: str, queue_capacity: int = 500):
        self.endpoint = endpoint
        self.token = token
        self.queue: collections.deque = collections.deque(maxlen=queue_capacity)
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "X-Agent-Token": self.token,
        })

    def forward_or_enqueue(self, payload: Dict[str, Any]) -> bool:
        """Attempt to send payload immediately; enqueue on failure."""
        # First flush any pending backlog
        self.flush_queue()

        success = self._send(payload)
        if not success:
            logger.warning(
                "Backend unavailable or returned error. Enqueuing event: %s (%s)",
                payload.get("event_type"),
                payload.get("container_name"),
            )
            self.queue.append(payload)
            return False
        return True

    def _send(self, payload: Dict[str, Any]) -> bool:
        """Perform POST request with timeout and inspect HTTP status code."""
        try:
            response = self.session.post(self.endpoint, json=payload, timeout=5.0)
            if response.status_code == 201:
                res_json = response.json()
                if res_json.get("deduplicated"):
                    logger.info("Event deduplicated by backend: event_id=%s", res_json.get("event_id"))
                else:
                    logger.info(
                        "Event ingested: %s on %s (event_id=%s)",
                        payload.get("event_type"),
                        payload.get("container_name"),
                        res_json.get("event_id"),
                    )
                return True
            else:
                logger.error(
                    "Backend returned unexpected status %s: %s",
                    response.status_code,
                    response.text,
                )
                return False
        except requests.RequestException as e:
            logger.error("Connection error while posting event: %s", e)
            return False

    def flush_queue(self) -> None:
        """Attempt to flush items currently in the retry queue."""
        if not self.queue:
            return

        logger.info("Attempting to flush %d queued events...", len(self.queue))
        unprocessed = []
        while self.queue:
            item = self.queue.popleft()
            if self._send(item):
                logger.info("Successfully delivered queued event %s", item.get("client_event_id"))
            else:
                unprocessed.append(item)
                # Keep remaining queue items
                unprocessed.extend(self.queue)
                self.queue.clear()
                break

        for item in unprocessed:
            self.queue.append(item)


def stream_docker_events():
    """Main loop: connect to Docker daemon socket and stream events."""
    token = validate_environment()
    forwarder = EventForwarder(INGEST_ENDPOINT, token, queue_capacity=QUEUE_CAPACITY)

    logger.info("Connecting to Docker daemon...")
    docker_client = docker.from_env()

    # Verify daemon connection
    try:
        version_info = docker_client.version()
        logger.info("Connected to Docker Engine version %s", version_info.get("Version"))
    except Exception as e:
        logger.critical("Failed to connect to Docker daemon: %s", e)
        sys.exit(1)

    # Prepare event filter: containers with label monitor=true
    event_filters = {"type": "container"}
    if LABEL_FILTER:
        event_filters["label"] = LABEL_FILTER
        logger.info("Filtering events by label: %s", LABEL_FILTER)

    logger.info("Starting Docker event streaming...")
    while True:
        try:
            # Check for any queued messages that can be flushed
            forwarder.flush_queue()

            # docker-py client.events yields dicts or json bytes depending on decode flag
            for raw_event in docker_client.events(decode=True, filters=event_filters):
                mapped_payload = map_docker_event(raw_event)
                if mapped_payload:
                    forwarder.forward_or_enqueue(mapped_payload)
        except docker.errors.APIError as e:
            logger.error("Docker API error in event loop: %s. Reconnecting in 3s...", e)
            time.sleep(3)
        except Exception as e:
            logger.error("Unexpected error in event loop: %s. Reconnecting in 3s...", e)
            time.sleep(3)


if __name__ == "__main__":
    stream_docker_events()
