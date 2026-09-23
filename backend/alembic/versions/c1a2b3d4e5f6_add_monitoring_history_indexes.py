"""Add indexes for monitoring history queries.

Revision ID: c1a2b3d4e5f6
Revises: bffc67d74211
"""
from typing import Sequence, Union

from alembic import op


revision: str = "c1a2b3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "bffc67d74211"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_status_history_printer_checked",
        "printer_status_history",
        ["printer_id", "checked_at"],
    )
    op.create_index(
        "ix_counters_printer_measured",
        "printer_counters",
        ["printer_id", "measured_at"],
    )
    op.create_index(
        "ix_supplies_snapshots_printer_measured",
        "printer_supplies_snapshots",
        ["printer_id", "measured_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_supplies_snapshots_printer_measured",
        table_name="printer_supplies_snapshots",
    )
    op.drop_index("ix_counters_printer_measured", table_name="printer_counters")
    op.drop_index("ix_status_history_printer_checked", table_name="printer_status_history")
