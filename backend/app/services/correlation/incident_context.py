"""
Incident context and evidence correlation service.

Collects real operational telemetry across the ±5-minute incident detection window:
  - Error and warning logs from Loki for the affected service.
  - Docker lifecycle events from the PostgreSQL events table for the affected service
    and its known dependencies (e.g. demo-app -> demo-db).
  - Source-availability notes explaining any missing or degraded telemetry source.
Also preserves the compact build_incident_context dict builder for AI RCA callers.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_

from app.models.incident import Incident
from app.models.models import Event
from app.schemas import LogLine, DockerEvent
from app.services.ingestion.loki_client import query_logs

logger = logging.getLogger(__name__)

# Known dependency relationships: service -> dependent services / containers
SERVICE_DEPENDENCIES: Dict[str, List[str]] = {
    "demo-app": ["demo-db"],
    "workload-generator": ["demo-db"],
}

# Known service aliases between container names and Compose service labels
SERVICE_ALIASES: Dict[str, List[str]] = {
    "demo-app": ["workload-generator"],
    "workload-generator": ["demo-app"],
}


def build_incident_context(incident: Incident) -> dict:
    """
    Build a self-contained context dict for a given Incident.

    Kept deliberately compact for AI RCA prompt generation (no ORM objects).
    """
    return {
        "incident_id": incident.id,
        "title": incident.title,
        "metric_name": incident.metric_name,
        "metric_value": incident.metric_value,
        "threshold": incident.threshold,
        "severity": incident.severity,
        "status": incident.status,
        "affected_service": incident.affected_service or "workload-generator",
        "detected_at": incident.detected_at.isoformat() if incident.detected_at else None,
        "description": incident.description or "",
        "affected_metrics": incident.affected_metrics or [incident.metric_name],
    }


def get_incident_time_window(detected_at: Optional[datetime], window_minutes: int = 5) -> Tuple[datetime, datetime]:
    """Calculate the [detected_at - 5m, detected_at + 5m] evidence time window."""
    base_time = detected_at or datetime.utcnow()
    start_time = base_time - timedelta(minutes=window_minutes)
    end_time = base_time + timedelta(minutes=window_minutes)
    return start_time, end_time


def collect_incident_logs(
    service: str,
    start_dt: datetime,
    end_dt: datetime,
    limit: int = 100,
) -> Tuple[List[LogLine], Optional[str]]:
    """
    Retrieve error and warning logs for the affected service within the time window using Loki client.
    Returns (logs, note_if_unavailable).
    """
    try:
        # Query for error/warning levels
        # We query with level="WARN" and level="ERROR", or query without level and filter
        # loki_client.query_logs supports level filter regex:
        # Passing level="WARN" will filter WARN/WARNING; passing level="ERROR" will filter ERROR/CRITICAL/FATAL
        # To get both, we query Loki without level restriction and filter in python,
        # or execute bounded query for errors/warnings.
        lines = query_logs(
            service=service,
            start_dt=start_dt,
            end_dt=end_dt,
            limit=limit,
        )
        # If no lines were returned and known aliases exist (e.g. demo-app vs workload-generator), check alias
        if not lines and service in SERVICE_ALIASES:
            for alias in SERVICE_ALIASES[service]:
                lines = query_logs(
                    service=alias,
                    start_dt=start_dt,
                    end_dt=end_dt,
                    limit=limit,
                )
                if lines:
                    break
        # Keep error and warning logs
        filtered_lines = [
            l for l in lines
            if l.level in ("WARN", "WARNING", "ERROR", "CRITICAL", "FATAL")
        ]
        return filtered_lines, None
    except Exception as exc:
        msg = f"Loki log source unavailable: {exc}"
        logger.warning(msg)
        return [], msg


def collect_docker_events(
    db: Session,
    affected_service: str,
    start_dt: datetime,
    end_dt: datetime,
    limit: int = 100,
) -> Tuple[List[DockerEvent], Optional[str]]:
    """
    Query PostgreSQL events table for the affected service and its known dependencies
    within the incident time window. Reads container name from payload->>'container_name'.
    Returns (events, note_if_unavailable).
    """
    try:
        # Determine relevant container / service names
        target_names = {affected_service}
        if affected_service in SERVICE_DEPENDENCIES:
            target_names.update(SERVICE_DEPENDENCIES[affected_service])
        # Also include standard alias if applicable
        if affected_service == "workload-generator":
            target_names.add("demo-app")
            target_names.add("demo-db")

        # Build database-level filter for target containers/services before applying limit
        c_name = Event.payload["container_name"].as_string()
        s_name = Event.payload["service"].as_string()
        target_filters = [
            c_name.in_(target_names),
            s_name.in_(target_names),
            Event.source.in_(target_names),
        ]
        for target in target_names:
            target_filters.append(c_name.like(f"%{target}%"))
            target_filters.append(s_name.like(f"%{target}%"))

        # Query events table within the time window filtered by target candidates
        query = db.query(Event).filter(
            Event.timestamp >= start_dt,
            Event.timestamp <= end_dt,
            or_(*target_filters),
        )

        rows = query.order_by(desc(Event.timestamp)).limit(limit).all()

        matched_events: List[DockerEvent] = []
        for row in rows:
            payload = row.payload or {}
            cname = payload.get("container_name")
            svc = payload.get("service") or (row.source if row.source != "docker" else "docker-engine")

            # Check if event belongs to affected service or known dependency
            # by container_name or service name
            is_relevant = False
            for target in target_names:
                if cname and (target == cname or target in cname):
                    is_relevant = True
                    break
                if svc and (target == svc or target in svc):
                    is_relevant = True
                    break

            if not is_relevant:
                continue

            msg = payload.get("message") or f"{row.event_type} on {cname or svc or 'host'}"
            matched_events.append(
                DockerEvent(
                    id=str(row.id),
                    timestamp=row.timestamp,
                    event_type=row.event_type,
                    service=svc,
                    container_name=cname,
                    severity=row.severity,
                    message=msg,
                    metadata=payload.get("details"),
                )
            )

        return matched_events, None
    except Exception as exc:
        msg = f"Docker event source unavailable: {exc}"
        logger.warning(msg)
        return [], msg


def get_incident_evidence(
    db: Session,
    incident: Incident,
    window_minutes: int = 5,
) -> Tuple[List[LogLine], List[DockerEvent], List[str]]:
    """
    Collect all correlated evidence for an incident:
      - Loki logs in [detected_at - 5m, detected_at + 5m]
      - Docker events in [detected_at - 5m, detected_at + 5m] for affected service and dependencies
      - Source availability notes for any missing/degraded sources
    """
    source_notes: List[str] = []
    start_dt, end_dt = get_incident_time_window(incident.detected_at, window_minutes=window_minutes)

    affected_svc = incident.affected_service or "demo-app"

    # 1. Logs
    logs, log_note = collect_incident_logs(
        service=affected_svc,
        start_dt=start_dt,
        end_dt=end_dt,
    )
    if log_note:
        source_notes.append(log_note)

    # 2. Docker Events
    events, event_note = collect_docker_events(
        db=db,
        affected_service=affected_svc,
        start_dt=start_dt,
        end_dt=end_dt,
    )
    if event_note:
        source_notes.append(event_note)

    return logs, events, source_notes
