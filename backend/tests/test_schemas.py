"""
test_schemas.py — Phase-1 schema serialization tests.

Verifies that:
1. All Phase-1 schemas produce camelCase JSON keys.
2. Models can be instantiated from snake_case kwargs (populate_by_name=True).
3. Envelope wraps list endpoints correctly.
"""
from datetime import datetime

import pytest

from app.schemas import (
    AlertSchema,
    ContainerSchema,
    Envelope,
    IncidentDetail,
    IncidentSchema,
    LogLine,
    MetricPoint,
    MetricSeries,
    RcaResult,
    ServerSchema,
    UserSchema,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

NOW = datetime(2026, 10, 10, 12, 0, 0)


def _camel_keys(obj) -> set[str]:
    """Return the top-level JSON keys of a schema model (aliased)."""
    return set(obj.model_dump(by_alias=True).keys())


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class TestUserSchema:
    def test_camel_keys(self):
        u = UserSchema(id=1, email="a@b.com", full_name="Alice", is_admin=False)
        keys = _camel_keys(u)
        assert "fullName" in keys
        assert "isAdmin" in keys
        assert "id" in keys
        assert "email" in keys

    def test_snake_input_accepted(self):
        u = UserSchema(id=1, email="a@b.com", full_name="Alice", is_admin=True)
        assert u.full_name == "Alice"
        assert u.is_admin is True


# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------

class TestServerSchema:
    def test_camel_keys(self):
        s = ServerSchema(
            id=1, hostname="host1", ip_address="10.0.0.1",
            status="active", uptime_seconds=3600.0,
            cpu_pct=12.5, mem_pct=40.0, disk_pct=55.0, container_count=3,
        )
        keys = _camel_keys(s)
        assert "ipAddress" in keys
        assert "uptimeSeconds" in keys
        assert "cpuPct" in keys
        assert "memPct" in keys
        assert "diskPct" in keys
        assert "containerCount" in keys

    def test_optional_fields_none(self):
        s = ServerSchema(id=2, hostname="h2", ip_address="10.0.0.2", status="offline")
        assert s.cpu_pct is None


# ---------------------------------------------------------------------------
# Container
# ---------------------------------------------------------------------------

class TestContainerSchema:
    def test_camel_keys(self):
        c = ContainerSchema(
            id="abc", name="web", service="frontend",
            status="running", cpu_pct=5.0, mem_mb=128.0,
            restart_count=0, started_at=NOW,
        )
        keys = _camel_keys(c)
        assert "cpuPct" in keys
        assert "memMb" in keys
        assert "restartCount" in keys
        assert "startedAt" in keys


# ---------------------------------------------------------------------------
# MetricSeries
# ---------------------------------------------------------------------------

class TestMetricSeries:
    def test_metric_point_camel(self):
        p = MetricPoint(t=NOW, v=42.0)
        d = p.model_dump(by_alias=True)
        assert "t" in d and "v" in d

    def test_series_camel(self):
        s = MetricSeries(metric="cpu_pct", label="CPU %", unit="%", points=[], threshold=80.0)
        keys = _camel_keys(s)
        assert "threshold" in keys
        assert "points" in keys


# ---------------------------------------------------------------------------
# Alert
# ---------------------------------------------------------------------------

class TestAlertSchema:
    def test_camel_keys(self):
        a = AlertSchema(
            id=1, rule_name="cpu_high", metric_name="cpu_pct",
            threshold=80.0, value=91.0, status="firing",
            triggered_at=NOW, incident_id=5,
        )
        keys = _camel_keys(a)
        assert "ruleName" in keys
        assert "metricName" in keys
        assert "triggeredAt" in keys
        assert "incidentId" in keys


# ---------------------------------------------------------------------------
# Incident
# ---------------------------------------------------------------------------

class TestIncidentSchema:
    def test_camel_keys(self):
        inc = IncidentSchema(
            id=1, title="High CPU", severity="high", status="open",
            detected_at=NOW, affected_metrics=["cpu_pct"],
        )
        keys = _camel_keys(inc)
        assert "detectedAt" in keys
        assert "affectedMetrics" in keys
        assert "serverId" in keys
        assert "affectedService" in keys
        assert "anomalyScore" in keys
        assert "resolvedAt" in keys
        assert "windowStart" in keys
        assert "windowEnd" in keys

    def test_snake_input(self):
        inc = IncidentSchema(
            id=2, title="Disk full", severity="critical",
            status="investigating", detected_at=NOW,
            affected_metrics=["disk_pct"],
            server_id=3,
        )
        assert inc.server_id == 3


# ---------------------------------------------------------------------------
# IncidentDetail
# ---------------------------------------------------------------------------

class TestIncidentDetail:
    def test_empty_evidence_fields(self):
        d = IncidentDetail(
            id=1, title="T", severity="low", status="candidate",
            detected_at=NOW, affected_metrics=[],
        )
        assert d.metric_evidence == []
        assert d.logs == []
        assert d.events == []
        assert d.analysis is None

    def test_camel_keys_present(self):
        d = IncidentDetail(
            id=1, title="T", severity="low", status="candidate",
            detected_at=NOW, affected_metrics=[],
        )
        keys = _camel_keys(d)
        assert "metricEvidence" in keys


# ---------------------------------------------------------------------------
# Envelope
# ---------------------------------------------------------------------------

class TestEnvelope:
    def test_wraps_items(self):
        users = [UserSchema(id=i, email=f"u{i}@x.com", is_admin=False) for i in range(3)]
        env = Envelope[UserSchema](items=users, total=3, limit=20, offset=0)
        assert len(env.items) == 3
        assert env.total == 3

    def test_json_serialization(self):
        users = [UserSchema(id=1, email="a@b.com", is_admin=False)]
        env = Envelope[UserSchema](items=users, total=1, limit=20, offset=0)
        data = env.model_dump(by_alias=True)
        assert "items" in data
        assert data["items"][0]["isAdmin"] is False


# ---------------------------------------------------------------------------
# RcaResult
# ---------------------------------------------------------------------------

class TestRcaResult:
    def test_knowledge_sources_empty_by_default(self):
        rca = RcaResult(
            incident_summary="High CPU",
            probable_root_cause="runaway process",
            confidence="medium",
            impact="Service degraded",
            model="gemini-1.5-pro",
            created_at=NOW,
        )
        assert rca.knowledge_sources == []

    def test_camel_keys(self):
        rca = RcaResult(
            incident_summary="s", probable_root_cause="r",
            confidence="low", impact="i",
            model="gemini-1.5-pro", created_at=NOW,
        )
        keys = _camel_keys(rca)
        assert "incidentSummary" in keys
        assert "probableRootCause" in keys
        assert "supportingEvidence" in keys
        assert "recommendedInvestigation" in keys
        assert "possibleRemediation" in keys
        assert "alternativeCauses" in keys
        assert "knowledgeSources" in keys
        assert "createdAt" in keys
