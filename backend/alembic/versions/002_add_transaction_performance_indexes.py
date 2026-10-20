"""Add transaction performance indexes for timestamp desc, type, and is_fraud

Revision ID: 002_add_tx_perf_indexes
Revises: 001_initial_schema
Create Date: 2026-10-20 07:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_add_tx_perf_indexes'
down_revision: Union[str, Sequence[str], None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add database indexes to accelerate pagination, filtering, and metric queries."""
    op.create_index(
        'ix_transactions_timestamp_desc',
        'transactions',
        [sa.text('timestamp DESC')],
        unique=False,
    )
    op.create_index(
        'ix_transactions_type',
        'transactions',
        ['type'],
        unique=False,
    )
    op.create_index(
        'ix_transactions_is_fraud',
        'transactions',
        ['is_fraud'],
        unique=False,
    )


def downgrade() -> None:
    """Drop performance indexes from transactions table."""
    op.drop_index('ix_transactions_is_fraud', table_name='transactions')
    op.drop_index('ix_transactions_type', table_name='transactions')
    op.drop_index('ix_transactions_timestamp_desc', table_name='transactions')

