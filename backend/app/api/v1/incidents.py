from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.incident import Incident
from app.schemas import Envelope, IncidentSchema, IncidentPatch, IncidentDetail
from app.services.correlation.incident_context import get_incident_evidence

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

@router.get("/{incident_id}", response_model=IncidentDetail)
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    """Get a specific incident by ID with correlated evidence (logs, Docker events, and source notes)."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    logs, events, source_notes = get_incident_evidence(db, incident)

    # Construct IncidentDetail from ORM object + correlated evidence
    incident_detail = IncidentDetail.model_validate(incident)
    incident_detail.logs = logs
    incident_detail.events = events
    incident_detail.source_notes = source_notes

    # Attach latest persisted AI analysis if available
    from app.models.models import AIAnalysis
    from app.schemas import RcaResult, KnowledgeSource, SupportingEvidence

    latest_analysis = (
        db.query(AIAnalysis)
        .filter(AIAnalysis.incident_id == incident_id, AIAnalysis.status == "success")
        .order_by(AIAnalysis.id.desc())
        .first()
    )
    if latest_analysis and latest_analysis.response_json:
        rj = latest_analysis.response_json
        incident_detail.analysis = RcaResult(
            incident_summary=rj.get("summary") or rj.get("incident_summary", ""),
            probable_root_cause=rj.get("probable_cause") or rj.get("probable_root_cause", ""),
            confidence=rj.get("confidence", "medium"),
            supporting_evidence=[
                SupportingEvidence(
                    text=e.get("text", "") if isinstance(e, dict) else str(e),
                )
                for e in rj.get("supporting_evidence", [])
            ],
            affected_components=rj.get("affected_components", []),
            impact=rj.get("impact", ""),
            recommended_investigation=rj.get("recommended_investigation", []),
            possible_remediation=rj.get("possible_remediation", []),
            alternative_causes=rj.get("alternative_causes", []),
            knowledge_sources=[
                KnowledgeSource(
                    title=ks.get("title", ""),
                    section=ks.get("section"),
                    score=ks.get("score"),
                )
                for ks in rj.get("knowledge_sources", [])
            ],
            model=latest_analysis.model_used or "gemini-1.5-flash",
            created_at=latest_analysis.created_at or datetime.utcnow(),
        )

    return incident_detail

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
