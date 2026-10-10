from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Server(Base):
    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)
    hostname = Column(String(255), unique=True, index=True, nullable=False)
    ip_address = Column(String(45), nullable=False)
    os_info = Column(String(255), nullable=True)
    status = Column(String(50), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    services = relationship("Service", back_populates="server")
    events = relationship("Event", back_populates="server")

class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=False)
    name = Column(String(255), nullable=False)
    service_type = Column(String(100), nullable=True)
    status = Column(String(50), default="running")
    created_at = Column(DateTime, default=datetime.utcnow)

    server = relationship("Server", back_populates="services")

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    client_event_id = Column(String(64), unique=True, nullable=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=True)
    event_type = Column(String(100), nullable=False)
    source = Column(String(100), nullable=False)
    severity = Column(String(50), default="info")
    payload = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    server = relationship("Server", back_populates="events")

from app.models.incident import Incident, Alert  # noqa: F401 – registers tables with Base.metadata

class IncidentEvent(Base):
    __tablename__ = "incident_events"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)

class IncidentLog(Base):
    __tablename__ = "incident_logs"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    log_line = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)


class AIAnalysis(Base):
    """Stored AI root-cause analysis for an incident.

    Confidence values: low | medium | high
    Status values    : success | unavailable
    """
    __tablename__ = "ai_analyses"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)

    # Legacy text fields kept for backward compat
    prompt = Column(Text, nullable=True)
    response = Column(Text, nullable=True)

    # Phase-1 fields
    model_used = Column(String(255), nullable=True)
    response_json = Column(JSON, nullable=True)
    confidence = Column(String(50), nullable=False, default="low")
    status = Column(String(50), nullable=False, default="success")
    created_at = Column(DateTime, default=datetime.utcnow)

    incident = relationship("Incident", back_populates="ai_analyses")

class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    vector_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class SystemConfiguration(Base):
    __tablename__ = "system_configurations"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, index=True, nullable=False)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
