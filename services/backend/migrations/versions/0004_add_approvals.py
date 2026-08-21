"""add approval requests

Revision ID: 0004_add_approvals
Revises: 0003_add_tasks
Create Date: 2026-08-17 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0004_add_approvals'
down_revision = '0003_add_tasks'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'approval_requests',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('draft_id', sa.Integer(), sa.ForeignKey('drafts.id'), nullable=True),
        sa.Column('event_id', sa.String(length=256), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table('approval_requests')
