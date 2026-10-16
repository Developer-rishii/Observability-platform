from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.incident import Incident, Alert
from app.services.detection.threshold_checker import calculate_severity


def get_open_incident_for_metric(
    db: Session, metric_name: str, server_id: Optional[int] = None
) -> Optional[Incident]:
    """Return an open or investigating incident for the given metric and server."""
    query = db.query(Incident).filter(
        Incident.metric_name == metric_name,
        Incident.status.in_(["open", "investigating"]),
    )
    if server_id is not None:
        query = query.filter(Incident.server_id == server_id)
    else:
        query = query.filter(Incident.server_id.is_(None))
    return query.first()


def create_incident(
    db: Session,
    metric_name: str,
    metric_value: float,
    threshold: float,
    server_id: Optional[int] = None,
    affected_service: Optional[str] = None,
    severity: Optional[str] = None,
    description: Optional[str] = None,
) -> Incident:
    """Create a new incident and an associated alert for a threshold breach."""
    if severity is None:
        severity = calculate_severity(metric_value, threshold)
    
    server_label = f" on server {server_id}" if server_id else ""
    title = f"High {metric_name} breach{server_label}"
    desc = description or f"{metric_name} exceeded threshold: {metric_value:.2f} > {threshold}"

    incident = Incident(
        title=title,
        description=desc,
        severity=severity,
        status="open",
        server_id=server_id,
        affected_service=affected_service,
        metric_name=metric_name,
        metric_value=metric_value,
        threshold=threshold,
        detected_at=datetime.utcnow(),
        affected_metrics=[metric_name],
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    
    alert = Alert(
        incident_id=incident.id,
        rule_name=f"{metric_name}_threshold",
        metric_name=metric_name,
        threshold=threshold,
        value=metric_value,
        status="firing",
        message=desc,
    )
    db.add(alert)
    db.commit()
    
    return incident


def resolve_incident(db: Session, incident: Incident) -> Incident:
    """Mark an open incident and its firing alerts as resolved."""
    incident.status = "resolved"
    incident.resolved_at = datetime.utcnow()

    # Also resolve linked firing alerts
    for alert in incident.alerts:
        if alert.status == "firing":
            alert.status = "resolved"

    db.commit()
    db.refresh(incident)
    return incident
