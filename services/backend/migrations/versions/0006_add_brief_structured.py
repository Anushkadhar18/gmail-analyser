"""add structured field to meeting_briefs

Revision ID: 0006_add_brief_structured
Revises: 0005_add_meeting_briefs
Create Date: 2026-08-17 01:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0006_add_brief_structured'
down_revision = '0005_add_meeting_briefs'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('meeting_briefs', sa.Column('structured', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('meeting_briefs', 'structured')
