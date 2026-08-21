"""add drafts table

Revision ID: 0002_add_drafts
Revises: 0001_initial
Create Date: 2026-08-14 00:10:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002_add_drafts'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'drafts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('thread_id', sa.String(length=256), nullable=True),
        sa.Column('subject', sa.String(length=512), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table('drafts')
