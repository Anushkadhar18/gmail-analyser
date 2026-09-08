"""add important flag and notes to tasks

Revision ID: 0007_add_task_important_notes
Revises: 0006_add_brief_structured
Create Date: 2026-09-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0007_add_task_important_notes'
down_revision = '0006_add_brief_structured'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tasks', sa.Column('important', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('tasks', sa.Column('notes', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('tasks', 'notes')
    op.drop_column('tasks', 'important')
