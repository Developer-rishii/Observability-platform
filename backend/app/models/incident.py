from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class Incident(Base):
    """Single source of truth for the incidents table.

    Severity values : critical | high | medium | low | info
    Status values   : candidate | open | investigating | resolved
    """
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)

    # Human-readable fields
    title = Column(String(255), nullable=False, default="Untitled Incident")
    description = Column(Text, nullable=True)

    # Classification
    severity = Column(String(50), nullable=False, default="medium")
    status = Column(String(50), nullable=False, default="open")

    # Origin / scope
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=True)
    affected_service = Column(String(255), nullable=True)

    # Metric evidence
    metric_name = Column(String(255), nullable=False)
    metric_value = Column(Float, nullable=False)
    threshold = Column(Float, nullable=False)
    anomaly_score = Column(Float, nullable=True)
    detection_source = Column(String(50), nullable=True, default="threshold")

    # Time window
    detected_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    window_start = Column(DateTime, nullable=True)
    window_end = Column(DateTime, nullable=True)

    # Affected metrics list (JSON array of metric name strings)
    affected_metrics = Column(JSON, nullable=False, default=list)

    # Relationships
    alerts = relationship("Alert", back_populates="incident")
    ai_analyses = relationship("AIAnalysis", back_populates="incident")


class Alert(Base):
    """Alert linked to an Incident.

    Status values: firing | acknowledged | resolved
    """
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)

    # Rule / metric context
    rule_name = Column(String(255), nullable=False, default="threshold")
    metric_name = Column(String(255), nullable=False)
    threshold = Column(Float, nullable=False)
    value = Column(Float, nullable=True)  # observed value at trigger time

    # Lifecycle
    status = Column(String(50), nullable=False, default="firing")
    triggered_at = Column(DateTime, nullable=True, default=datetime.utcnow)

    # Legacy message field kept for backward compat
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    incident = relationship("Incident", back_populates="alerts")
