"""create initial tables

Revision ID: 0001_init
Revises:
Create Date: 2026-02-12 18:30:00
"""


# revision identifiers, used by Alembic.
revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Initial revision intentionally no-op because app startup manages table creation
    # in local/dev. Replace with explicit DDL in production rollout.
    pass


def downgrade() -> None:
    pass
