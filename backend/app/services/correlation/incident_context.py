"""
Prometheus incident context builder.

Returns a plain dict with the key facts an LLM needs to produce a
root-cause analysis. Kept deliberately small so the prompt stays short.
"""
from typing import Optional
from app.models.incident import Incident


def build_incident_context(incident: Incident) -> dict:
    """
    Build a self-contained context dict for a given Incident.

    The returned dict is JSON-serialisable (no ORM objects).
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
