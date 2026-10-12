from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.incident import Incident
from app.schemas import Envelope, IncidentSchema, IncidentPatch

router = APIRouter()

_VALID_TRANSITIONS = {
    "candidate": {"open"},
    "open": {"investigating", "resolved"},
    "investigating": {"resolved"},
    "resolved": set(),  # terminal
}

@router.get("", response_model=Envelope[IncidentSchema])
@router.get("/", response_model=Envelope[IncidentSchema])
def list_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """List incidents, optionally filtered by status and severity."""
    query = db.query(Incident)
    if status and status != "all":
        query = query.filter(Incident.status == status)
    if severity and severity != "all":
        query = query.filter(Incident.severity == severity)
    
    total = query.count()
    incidents = query.order_by(Incident.detected_at.desc()).offset(offset).limit(limit).all()
    return Envelope(items=incidents, total=total, limit=limit, offset=offset)

@router.get("/{incident_id}", response_model=IncidentSchema)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    """Get a specific incident by ID."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@router.patch("/{incident_id}/status", response_model=IncidentSchema)
def patch_incident_status(
    incident_id: int,
    body: IncidentPatch,
    db: Session = Depends(get_db),
):
    """
    PATCH /incidents/{id}/status — advance an incident through its lifecycle.

    Allowed transitions:
      candidate → open
      open → investigating | resolved
      investigating → resolved
    """
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    allowed = _VALID_TRANSITIONS.get(incident.status, set())
    if body.status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot transition from '{incident.status}' to '{body.status}'. "
                   f"Allowed: {sorted(allowed) or 'none (terminal state)'}",
        )

    from datetime import datetime
    incident.status = body.status
    if body.status == "resolved":
        incident.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(incident)
    return incident
