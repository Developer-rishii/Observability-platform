"""add detection_source to incidents

Revision ID: 0004_detection_source
Revises: 0003_auth_tokens
Create Date: 2026-10-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_detection_source"
down_revision: Union[str, None] = "0003_auth_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "incidents",
        sa.Column(
            "detection_source",
            sa.String(length=50),
            nullable=True,
            server_default="threshold",
        ),
    )


def downgrade() -> None:
    op.drop_column("incidents", "detection_source")
