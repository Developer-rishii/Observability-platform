from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.incident import Alert, Incident
from app.schemas import Envelope, AlertSchema, AlertPatch

router = APIRouter()

_VALID_ALERT_TRANSITIONS = {
    "firing": {"acknowledged", "resolved"},
    "acknowledged": {"resolved", "firing"},
    "resolved": set(),
}

@router.get("", response_model=Envelope[AlertSchema])
@router.get("/", response_model=Envelope[AlertSchema])
def list_alerts(
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """List firing, acknowledged, or resolved alerts."""
    query = db.query(Alert)
    if status and status != "all":
        query = query.filter(Alert.status == status)
    
    total = query.count()
    alerts = query.order_by(Alert.triggered_at.desc()).offset(offset).limit(limit).all()
    return Envelope(items=alerts, total=total, limit=limit, offset=offset)

@router.get("/{alert_id}", response_model=AlertSchema)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    """Fetch an individual alert by ID."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert

@router.patch("/{alert_id}/status", response_model=AlertSchema)
def patch_alert_status(
    alert_id: int,
    body: AlertPatch,
    db: Session = Depends(get_db)
):
    """
    Update alert lifecycle status:
    Allowed transitions:
      firing -> acknowledged | resolved
      acknowledged -> resolved
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    if body.status not in ["firing", "acknowledged", "resolved"]:
        raise HTTPException(status_code=422, detail=f"Invalid alert status: {body.status}")

    alert.status = body.status
    db.commit()
    db.refresh(alert)
    return alert
