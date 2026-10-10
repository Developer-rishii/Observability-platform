from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.incident import Incident
from app.schemas import Envelope, IncidentSchema

router = APIRouter()

@router.get("/", response_model=Envelope[IncidentSchema])
def list_incidents(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List incidents, optionally filtered by status."""
    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status)
    
    # Order by detected_at descending
    incidents = query.order_by(Incident.detected_at.desc()).all()
    
    return Envelope(items=incidents, total=len(incidents), limit=100, offset=0)

@router.get("/{incident_id}", response_model=IncidentSchema)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    """Get a specific incident by ID."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

