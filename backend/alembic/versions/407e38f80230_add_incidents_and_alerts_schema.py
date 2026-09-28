"""add incidents and alerts schema

Revision ID: 407e38f80230
Revises: 41cfb96dbef2
Create Date: 2026-09-28 19:31:58.142317

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '407e38f80230'
down_revision: Union[str, None] = '41cfb96dbef2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update incidents table schema to match Incident model
    op.add_column('incidents', sa.Column('metric_name', sa.String(length=255), nullable=False))
    op.add_column('incidents', sa.Column('metric_value', sa.Float(), nullable=False))
    op.add_column('incidents', sa.Column('threshold', sa.Float(), nullable=False))
    op.add_column('incidents', sa.Column('triggered_at', sa.DateTime(), nullable=False))
    op.alter_column('incidents', 'severity',
               existing_type=sa.String(length=50),
               nullable=False)
    op.alter_column('incidents', 'status',
               existing_type=sa.String(length=50),
               nullable=False,
               server_default='open')
    op.drop_column('incidents', 'created_at')
    op.drop_column('incidents', 'description')
    op.drop_column('incidents', 'title')

    # Update alerts table schema to match Alert model
    op.add_column('alerts', sa.Column('incident_id', sa.Integer(), nullable=False))
    op.add_column('alerts', sa.Column('message', sa.Text(), nullable=False))
    op.add_column('alerts', sa.Column('created_at', sa.DateTime(), nullable=False))
    op.create_foreign_key(
        'fk_alerts_incident_id_incidents',
        'alerts',
        'incidents',
        ['incident_id'],
        ['id']
    )
    op.drop_column('alerts', 'triggered_at')
    op.drop_column('alerts', 'status')
    op.drop_column('alerts', 'threshold')
    op.drop_column('alerts', 'metric_name')
    op.drop_column('alerts', 'rule_name')


def downgrade() -> None:
    # Revert alerts table schema
    op.add_column('alerts', sa.Column('rule_name', sa.String(length=255), nullable=False))
    op.add_column('alerts', sa.Column('metric_name', sa.String(length=255), nullable=False))
    op.add_column('alerts', sa.Column('threshold', sa.Float(), nullable=False))
    op.add_column('alerts', sa.Column('status', sa.String(length=50), nullable=True))
    op.add_column('alerts', sa.Column('triggered_at', sa.DateTime(), nullable=True))
    op.drop_constraint('fk_alerts_incident_id_incidents', 'alerts', type_='foreignkey')
    op.drop_column('alerts', 'created_at')
    op.drop_column('alerts', 'message')
    op.drop_column('alerts', 'incident_id')

    # Revert incidents table schema
    op.add_column('incidents', sa.Column('title', sa.String(length=255), nullable=False))
    op.add_column('incidents', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('incidents', sa.Column('created_at', sa.DateTime(), nullable=True))
    op.alter_column('incidents', 'status',
               existing_type=sa.String(length=50),
               nullable=True,
               server_default=None)
    op.alter_column('incidents', 'severity',
               existing_type=sa.String(length=50),
               nullable=True)
    op.drop_column('incidents', 'triggered_at')
    op.drop_column('incidents', 'threshold')
    op.drop_column('incidents', 'metric_value')
    op.drop_column('incidents', 'metric_name')
