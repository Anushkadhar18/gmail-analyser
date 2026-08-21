"""add tasks table

Revision ID: 0003_add_tasks
Revises: 0002_add_drafts
Create Date: 2026-08-14 00:20:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0003_add_tasks'
down_revision = '0002_add_drafts'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'tasks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('source_message_id', sa.String(length=256), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('action_required', sa.String(length=64), nullable=True),
        sa.Column('completed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('metadata', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )


def downgrade():
    op.drop_table('tasks')
