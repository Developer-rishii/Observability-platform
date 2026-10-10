from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.incident import Incident, Alert

def get_open_incident_for_metric(db: Session, metric_name: str) -> Optional[Incident]:
    """Return an open or investigating incident for the given metric."""
    return db.query(Incident).filter(
        Incident.metric_name == metric_name,
        Incident.status.in_(["open", "investigating"])
    ).first()

def create_incident(db: Session, metric_name: str, metric_value: float, threshold: float) -> Incident:
    """Create a new incident and an associated alert for a threshold breach."""
    severity = "critical" if metric_value > threshold * 1.2 else "high"
    
    incident = Incident(
        title=f"High {metric_name} usage",
        description=f"{metric_name} exceeded threshold: {metric_value:.2f} > {threshold}",
        severity=severity,
        status="open",
        metric_name=metric_name,
        metric_value=metric_value,
        threshold=threshold,
        detected_at=datetime.utcnow(),
        affected_metrics=[metric_name]
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
        status="firing"
    )
    db.add(alert)
    db.commit()
    
    return incident
