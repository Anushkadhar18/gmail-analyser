"""add meeting briefs

Revision ID: 0005_add_meeting_briefs
Revises: 0004_add_approvals
Create Date: 2026-08-17 00:05:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0005_add_meeting_briefs'
down_revision = '0004_add_approvals'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'meeting_briefs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('event_id', sa.String(length=256), nullable=False),
        sa.Column('brief', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )


def downgrade():
    op.drop_table('meeting_briefs')
