"""
Events API endpoints.
Provides:
  POST /api/v1/events/ingest  – authenticated machine ingestion endpoint (shared secret)
  GET  /api/v1/events         – query persisted operational events with filters
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.config import settings
from app.core.database import get_db
from app.models.models import Event
from app.schemas import DockerEvent

router = APIRouter()

# ---------------------------------------------------------------------------
# Ingestion Schema
# ---------------------------------------------------------------------------

class EventIngestPayload(BaseModel):
    client_event_id: Optional[str] = Field(None, max_length=64, description="Unique client-supplied idempotency key")
    server_id: Optional[int] = Field(None, description="Optional monitored server ID")
    event_type: str = Field(..., max_length=100, description="Event action (e.g., container.die, container.start, oom)")
    source: str = Field("docker", max_length=100, description="Event source agent/daemon")
    severity: Optional[str] = Field("info", max_length=50, description="Severity: info | warning | critical")
    service: Optional[str] = Field(None, max_length=255, description="Associated microservice or component")
    container_name: Optional[str] = Field(None, max_length=255, description="Container name or resource ID")
    message: str = Field(..., max_length=1000, description="Human-readable event description")
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow, description="Event generation timestamp")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Arbitrary validated metadata payload")

class EventIngestResponse(BaseModel):
    status: str
    event_id: int
    deduplicated: bool = False

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/ingest", response_model=EventIngestResponse, status_code=status.HTTP_201_CREATED)
def ingest_event(
    payload: EventIngestPayload,
    db: Session = Depends(get_db),
    x_agent_token: Optional[str] = Header(None, alias="X-Agent-Token"),
):
    """
    Authenticated ingestion endpoint for collectors and agent forwarders.
    Uses constant-time comparison against AGENT_SHARED_SECRET.
    Guarantees idempotency via client_event_id.
    """
    if not x_agent_token or x_agent_token != settings.AGENT_SHARED_SECRET:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Agent-Token authorization header.",
        )

    # 1. Idempotency deduplication check
    if payload.client_event_id:
        existing = db.query(Event).filter(Event.client_event_id == payload.client_event_id).first()
        if existing:
            return EventIngestResponse(
                status="accepted",
                event_id=existing.id,
                deduplicated=True,
            )

    # 2. Defensible severity rules
    severity = (payload.severity or "info").lower()
    if payload.event_type in ("container.die", "oom", "container.oom"):
        severity = "critical"
    elif payload.event_type in ("container.restart", "anomaly.flagged", "warning"):
        severity = "warning"
    elif severity not in ("info", "warning", "critical"):
        severity = "info"

    # 3. Assemble structured JSON payload
    event_data = {
        "service": payload.service,
        "container_name": payload.container_name,
        "message": payload.message,
        "details": payload.metadata or {},
    }

    record = Event(
        client_event_id=payload.client_event_id,
        server_id=payload.server_id,
        event_type=payload.event_type,
        source=payload.source,
        severity=severity,
        payload=event_data,
        timestamp=payload.timestamp or datetime.utcnow(),
    )

    try:
        db.add(record)
        db.commit()
        db.refresh(record)
        return EventIngestResponse(
            status="created",
            event_id=record.id,
            deduplicated=False,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist event record: {e}",
        )


@router.get("", response_model=List[DockerEvent])
@router.get("/", response_model=List[DockerEvent])
def list_events(
    db: Session = Depends(get_db),
    type: Optional[str] = Query(None, description="Filter by event type"),
    severity: Optional[str] = Query(None, description="Filter by severity: critical | warning | info"),
    service: Optional[str] = Query(None, description="Filter by service name"),
    q: Optional[str] = Query(None, description="Search query string"),
    limit: int = Query(100, ge=1, le=500, description="Max events to return"),
):
    """
    Query persisted operational events from PostgreSQL ordered by timestamp descending.
    """
    query = db.query(Event)

    if type:
        query = query.filter(Event.event_type == type)
    if severity and severity.lower() != "all":
        query = query.filter(Event.severity == severity.lower())
    if service:
        # payload is JSON with 'service' key
        query = query.filter(Event.payload["service"].astext == service)

    query = query.order_by(desc(Event.timestamp)).limit(limit)
    rows = query.all()

    results: List[DockerEvent] = []
    for row in rows:
        payload = row.payload or {}
        svc = payload.get("service") or (row.source if row.source != "docker" else "docker-engine")
        cname = payload.get("container_name")
        msg = payload.get("message") or f"{row.event_type} on {cname or 'host'}"

        if q and q.strip():
            clean_q = q.strip().lower()
            if clean_q not in msg.lower() and clean_q not in svc.lower() and clean_q not in row.event_type.lower():
                continue

        results.append(DockerEvent(
            id=str(row.id),
            timestamp=row.timestamp,
            event_type=row.event_type,
            service=svc,
            container_name=cname,
            severity=row.severity,
            message=msg,
            metadata=payload.get("details"),
        ))

    return results
