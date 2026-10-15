"""Initial schema creating transactions, investigation_cases, and replay_runs

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-15 15:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to create all core tables."""
    # 1. Transactions table
    op.create_table(
        'transactions',
        sa.Column('transaction_id', sa.String(length=64), nullable=False),
        sa.Column('account_id', sa.String(length=64), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('type', sa.String(length=20), server_default='TRANSFER', nullable=True),
        sa.Column('oldbalance_org', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('newbalance_orig', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('oldbalance_dest', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('newbalance_dest', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('device_id', sa.String(length=64), nullable=True),
        sa.Column('session_id', sa.String(length=64), nullable=True),
        sa.Column('is_fraud', sa.Integer(), server_default='0', nullable=False),
        sa.Column('payment_attempts', sa.Integer(), server_default='1', nullable=True),
        sa.Column('risk_score', sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint('transaction_id'),
    )
    op.create_index(op.f('ix_transactions_account_id'), 'transactions', ['account_id'], unique=False)
    op.create_index(op.f('ix_transactions_transaction_id'), 'transactions', ['transaction_id'], unique=False)
    op.create_index(op.f('ix_transactions_risk_score'), 'transactions', ['risk_score'], unique=False)

    # 2. Investigation Cases table
    op.create_table(
        'investigation_cases',
        sa.Column('case_id', sa.String(length=64), nullable=False),
        sa.Column('transaction_id', sa.String(length=64), nullable=False),
        sa.Column('assigned_analyst', sa.String(length=64), server_default='Unassigned', nullable=True),
        sa.Column('status', sa.String(length=32), server_default='open', nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('feedback_label', sa.String(length=32), nullable=True),
        sa.Column('feedback_reasoning', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions.transaction_id']),
        sa.PrimaryKeyConstraint('case_id'),
    )
    op.create_index(op.f('ix_investigation_cases_case_id'), 'investigation_cases', ['case_id'], unique=False)

    # 3. Replay Runs table
    op.create_table(
        'replay_runs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('model_version', sa.String(length=50), nullable=False),
        sa.Column('threshold', sa.Float(), nullable=False),
        sa.Column('start_step', sa.Integer(), nullable=False),
        sa.Column('end_step', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='QUEUED', nullable=False),
        sa.Column('metrics_summary', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_replay_runs_id'), 'replay_runs', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema dropping all created tables."""
    op.drop_index(op.f('ix_replay_runs_id'), table_name='replay_runs')
    op.drop_table('replay_runs')
    op.drop_index(op.f('ix_investigation_cases_case_id'), table_name='investigation_cases')
    op.drop_table('investigation_cases')
    op.drop_index(op.f('ix_transactions_transaction_id'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_account_id'), table_name='transactions')
    op.drop_table('transactions')

