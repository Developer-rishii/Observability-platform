"""phase1 model reconciliation

Extends Incident with full Phase-1 fields (explicit rename triggered_at -> detected_at),
extends Alert with rule_name / metric_name / threshold / value / status / triggered_at,
extends AIAnalysis with model_used / response_json / confidence / status.

RULE: never edit an existing migration.

Revision ID: 0002_phase1_model_reconciliation
Revises: 407e38f80230
Create Date: 2026-10-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0002_phase1_model_reconciliation"
down_revision: Union[str, None] = "407e38f80230"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------ #
    # incidents                                                            #
    # ------------------------------------------------------------------ #

    # 1. Rename triggered_at -> detected_at  (explicit rename, not drop/add)
    op.alter_column(
        "incidents",
        "triggered_at",
        new_column_name="detected_at",
        existing_type=sa.DateTime(),
        existing_nullable=False,
    )

    # 2. Add new Phase-1 fields.
    #    metric_name, metric_value, threshold, severity, status already exist
    #    from migrations 0001 / 407e38f80230 — do NOT re-add.
    #
    #    NOT NULL columns get server_default so they work on tables with rows.

    op.add_column(
        "incidents",
        sa.Column("title", sa.String(length=255), nullable=False, server_default="Untitled Incident"),
    )
    op.add_column(
        "incidents",
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.add_column(
        "incidents",
        sa.Column("server_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_incidents_server_id_servers",
        "incidents",
        "servers",
        ["server_id"],
        ["id"],
    )
    op.add_column(
        "incidents",
        sa.Column("affected_service", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "incidents",
        sa.Column("anomaly_score", sa.Float(), nullable=True),
    )
    op.add_column(
        "incidents",
        sa.Column("window_start", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "incidents",
        sa.Column("window_end", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "incidents",
        sa.Column("affected_metrics", sa.JSON(), nullable=False, server_default="[]"),
    )

    # ------------------------------------------------------------------ #
    # alerts — restore and extend the fields dropped by 407e38f80230      #
    # ------------------------------------------------------------------ #
    # 407e38f80230 dropped: rule_name, metric_name, threshold, status, triggered_at
    # It kept: id, incident_id, message, created_at
    # Phase-1 shape adds them back plus a new nullable 'value' column.

    op.add_column(
        "alerts",
        sa.Column("rule_name", sa.String(length=255), nullable=False, server_default="threshold"),
    )
    op.add_column(
        "alerts",
        sa.Column("metric_name", sa.String(length=255), nullable=False, server_default="unknown"),
    )
    op.add_column(
        "alerts",
        sa.Column("threshold", sa.Float(), nullable=False, server_default="0"),
    )
    op.add_column(
        "alerts",
        sa.Column("value", sa.Float(), nullable=True),
    )
    op.add_column(
        "alerts",
        sa.Column("status", sa.String(length=50), nullable=False, server_default="firing"),
    )
    op.add_column(
        "alerts",
        sa.Column("triggered_at", sa.DateTime(), nullable=True),
    )

    # ------------------------------------------------------------------ #
    # ai_analyses — extend with Phase-1 fields                            #
    # ------------------------------------------------------------------ #
    op.add_column(
        "ai_analyses",
        sa.Column("model_used", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "ai_analyses",
        sa.Column("response_json", sa.JSON(), nullable=True),
    )
    op.add_column(
        "ai_analyses",
        sa.Column("confidence", sa.String(length=50), nullable=False, server_default="low"),
    )
    op.add_column(
        "ai_analyses",
        sa.Column("status", sa.String(length=50), nullable=False, server_default="success"),
    )


def downgrade() -> None:
    # ai_analyses
    op.drop_column("ai_analyses", "status")
    op.drop_column("ai_analyses", "confidence")
    op.drop_column("ai_analyses", "response_json")
    op.drop_column("ai_analyses", "model_used")

    # alerts
    op.drop_column("alerts", "triggered_at")
    op.drop_column("alerts", "status")
    op.drop_column("alerts", "value")
    op.drop_column("alerts", "threshold")
    op.drop_column("alerts", "metric_name")
    op.drop_column("alerts", "rule_name")

    # incidents
    op.drop_column("incidents", "affected_metrics")
    op.drop_column("incidents", "window_end")
    op.drop_column("incidents", "window_start")
    op.drop_column("incidents", "anomaly_score")
    op.drop_column("incidents", "affected_service")
    op.drop_constraint("fk_incidents_server_id_servers", "incidents", type_="foreignkey")
    op.drop_column("incidents", "server_id")
    op.drop_column("incidents", "description")
    op.drop_column("incidents", "title")

    # rename back
    op.alter_column(
        "incidents",
        "detected_at",
        new_column_name="triggered_at",
        existing_type=sa.DateTime(),
        existing_nullable=False,
    )
