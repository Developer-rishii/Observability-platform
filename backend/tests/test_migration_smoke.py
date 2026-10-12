"""
test_migration_smoke.py — Migration smoke test.

Verifies that:
1. alembic heads returns exactly one head (0002_phase1_model_reconciliation).
2. All expected Phase-1 columns exist in the live database after alembic upgrade head.

Requires DATABASE_URL in .env pointing to the running Postgres container.
Skipped automatically if the DB is unreachable.
"""
import os
import pytest

try:
    import psycopg2
    _PSYCOPG2_AVAILABLE = True
except ImportError:
    _PSYCOPG2_AVAILABLE = False

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_db_url() -> str:
    """Read DATABASE_URL from env (pydantic-settings loads .env automatically)."""
    from app.core.config import settings
    return settings.DATABASE_URL


def _conn():
    """Return a live psycopg2 connection or raise."""
    url = _get_db_url()
    # Convert postgresql:// -> psycopg2 kwargs
    if url.startswith("postgresql://") or url.startswith("postgresql+psycopg2://"):
        url = url.replace("postgresql+psycopg2://", "postgresql://")
        import urllib.parse as up
        parsed = up.urlparse(url)
        return psycopg2.connect(
            host=parsed.hostname,
            port=parsed.port or 5432,
            dbname=parsed.path.lstrip("/"),
            user=parsed.username,
            password=parsed.password,
            connect_timeout=3,
        )
    raise ValueError(f"Unsupported DATABASE_URL scheme: {url}")


def _columns(conn, table: str) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name = %s",
            (table,),
        )
        return {row[0] for row in cur.fetchall()}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def db_conn():
    if not _PSYCOPG2_AVAILABLE:
        pytest.skip("psycopg2 not installed")
    try:
        conn = _conn()
    except Exception as exc:
        pytest.skip(f"Database unreachable: {exc}")
    yield conn
    conn.close()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestMigrationSmoke:
    def test_alembic_head_is_phase1(self, db_conn):
        """alembic_version table must contain exactly one row at latest head."""
        with db_conn.cursor() as cur:
            cur.execute("SELECT version_num FROM alembic_version")
            rows = cur.fetchall()
        assert len(rows) == 1, f"Expected 1 alembic head, got {len(rows)}: {rows}"
        assert rows[0][0] in ("0002_phase1_model_reconciliation", "0003_auth_tokens"), (
            f"Unexpected head: {rows[0][0]}"
        )

    def test_incidents_phase1_columns(self, db_conn):
        cols = _columns(db_conn, "incidents")
        required = {
            "id", "title", "description", "severity", "status",
            "server_id", "affected_service", "metric_name", "metric_value",
            "threshold", "anomaly_score", "detected_at", "resolved_at",
            "window_start", "window_end", "affected_metrics",
        }
        missing = required - cols
        assert not missing, f"incidents table missing columns: {missing}"
        assert "triggered_at" not in cols, "triggered_at should have been renamed to detected_at"

    def test_alerts_phase1_columns(self, db_conn):
        cols = _columns(db_conn, "alerts")
        required = {
            "id", "incident_id", "rule_name", "metric_name",
            "threshold", "value", "status", "triggered_at",
        }
        missing = required - cols
        assert not missing, f"alerts table missing columns: {missing}"

    def test_ai_analyses_phase1_columns(self, db_conn):
        cols = _columns(db_conn, "ai_analyses")
        required = {
            "id", "incident_id", "model_used", "response_json",
            "confidence", "status", "created_at",
        }
        missing = required - cols
        assert not missing, f"ai_analyses table missing columns: {missing}"
