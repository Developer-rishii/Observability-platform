"""
Pydantic v2 schemas for the Observability Platform API.

All schemas use camelCase JSON keys via alias_generator=to_camel,
while also accepting snake_case on input (populate_by_name=True).

List endpoints return an Envelope[T].
Error responses return ErrorResponse.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, field_validator
from pydantic.alias_generators import to_camel

# ---------------------------------------------------------------------------
# Base config shared by all schemas
# ---------------------------------------------------------------------------

class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# ---------------------------------------------------------------------------
# Envelope / Error
# ---------------------------------------------------------------------------

DataT = TypeVar("DataT")


class Envelope(BaseModel, Generic[DataT]):
    """Standard list-endpoint envelope: {items, total, limit, offset}."""
    items: List[DataT]
    total: int
    limit: int
    offset: int


class ErrorResponse(_Base):
    detail: str
    code: str


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class UserSchema(_Base):
    id: int
    email: str
    full_name: Optional[str] = None
    is_admin: bool


# ---------------------------------------------------------------------------
# Server / Container
# ---------------------------------------------------------------------------

class ServerSchema(_Base):
    id: int
    hostname: str
    ip_address: str
    os_info: Optional[str] = None
    status: str  # active | degraded | offline
    uptime_seconds: Optional[float] = None
    cpu_pct: Optional[float] = None
    mem_pct: Optional[float] = None
    disk_pct: Optional[float] = None
    container_count: Optional[int] = None


class ContainerSchema(_Base):
    id: str
    name: str
    service: str
    status: str  # running | exited | restarting | paused
    cpu_pct: Optional[float] = None
    mem_mb: Optional[float] = None
    restart_count: int = 0
    started_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

class MetricPoint(_Base):
    t: datetime  # timestamp
    v: float     # value


class AnomalyMarker(_Base):
    t: datetime
    score: float


class MetricSeries(_Base):
    metric: str
    label: str
    unit: str
    points: List[MetricPoint] = []
    threshold: Optional[float] = None
    anomalies: Optional[List[AnomalyMarker]] = None


# ---------------------------------------------------------------------------
# Alert
# ---------------------------------------------------------------------------

class AlertSchema(_Base):
    id: int
    rule_name: str
    metric_name: str
    threshold: float
    value: Optional[float] = None
    status: str  # firing | acknowledged | resolved
    triggered_at: Optional[datetime] = None
    incident_id: Optional[int] = None


class AlertPatch(_Base):
    """Allowed fields for PATCH /alerts/{id}."""
    status: str  # firing | acknowledged | resolved


# ---------------------------------------------------------------------------
# Incident
# ---------------------------------------------------------------------------

class IncidentSchema(_Base):
    id: int
    title: str
    description: Optional[str] = None
    severity: str  # critical | high | medium | low | info
    status: str    # candidate | open | investigating | resolved
    server_id: Optional[int] = None
    affected_service: Optional[str] = None
    metric_name: str
    metric_value: float
    threshold: float
    anomaly_score: Optional[float] = None
    detected_at: datetime
    resolved_at: Optional[datetime] = None
    window_start: Optional[datetime] = None
    window_end: Optional[datetime] = None
    affected_metrics: List[str] = []


class IncidentPatch(_Base):
    """Allowed fields for PATCH /incidents/{id}."""
    status: str


# ---------------------------------------------------------------------------
# AI Root-Cause Analysis
# ---------------------------------------------------------------------------

class RCAOut(_Base):
    """Structured response returned by POST /incidents/{id}/analyze."""
    summary: str
    probable_cause: str
    confidence: str   # low | medium | high
    next_steps: List[str]



# ---------------------------------------------------------------------------
# Logs / Events (stubs — Loki and Docker events agent are DEFERRED)
# ---------------------------------------------------------------------------

class LogLine(_Base):
    id: str
    timestamp: datetime
    level: str
    service: str
    container: Optional[str] = None
    message: str


class DockerEvent(_Base):
    id: str
    timestamp: datetime
    event_type: str
    service: Optional[str] = None
    container_name: Optional[str] = None
    severity: str
    message: str
    metadata: Optional[Any] = None


# ---------------------------------------------------------------------------
# RCA / AI
# ---------------------------------------------------------------------------

class EvidenceRef(_Base):
    type: str  # metric | log | event
    id: str


class SupportingEvidence(_Base):
    text: str
    ref: Optional[EvidenceRef] = None


class KnowledgeSource(_Base):
    title: str
    section: Optional[str] = None
    score: Optional[float] = None


class RcaResult(_Base):
    incident_summary: str
    probable_root_cause: str
    confidence: str  # low | medium | high
    supporting_evidence: List[SupportingEvidence] = []
    affected_components: List[str] = []
    impact: str
    recommended_investigation: List[str] = []
    possible_remediation: List[str] = []
    alternative_causes: List[str] = []
    knowledge_sources: List[KnowledgeSource] = []  # empty list until RAG is live
    model: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Incident Detail (Incident + evidence)
# ---------------------------------------------------------------------------

class IncidentDetail(IncidentSchema):
    metric_evidence: List[MetricSeries] = []
    logs: List[LogLine] = []         # deferred — always empty for now
    events: List[DockerEvent] = []   # deferred — always empty for now
    analysis: Optional[RcaResult] = None


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(_Base):
    email: str
    password: str


class TokenResponse(_Base):
    access_token: str
    token_type: str = "bearer"
    user: UserSchema
