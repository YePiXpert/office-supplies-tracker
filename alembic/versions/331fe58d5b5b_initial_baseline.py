"""initial baseline

Revision ID: 331fe58d5b5b
Revises: 
Create Date: 2026-03-03 14:49:31.487910

"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = '331fe58d5b5b'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 基线版本：用于将既有数据库纳入 Alembic 版本管理。
    # 现有项目由应用层初始化表结构，因此这里不做 DDL 变更。
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
