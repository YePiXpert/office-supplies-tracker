from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import BOOLEAN, JSON, REAL, INTEGER, TEXT, TIMESTAMP, ForeignKey
from sqlalchemy import Column, Index, UniqueConstraint, event, inspect, text
from sqlalchemy.orm import declarative_base

from .audit_context import get_current_operator_ip


Base = declarative_base()


class SystemSecurity(Base):
    __tablename__ = "system_security"

    id = Column(INTEGER, primary_key=True)
    password_hash = Column(TEXT, nullable=False)
    recovery_code_hash = Column(TEXT, nullable=False)
    failed_attempts = Column(INTEGER, nullable=False, server_default=text("0"))
    locked_until = Column(TIMESTAMP)


class Supplier(Base):
    __tablename__ = "suppliers"
    __table_args__ = (
        Index("idx_suppliers_name", "name"),
    )

    id = Column(INTEGER, primary_key=True, autoincrement=True)
    name = Column(TEXT, nullable=False, unique=True)
    contact_name = Column(TEXT)
    contact_phone = Column(TEXT)
    contact_email = Column(TEXT)
    notes = Column(TEXT)
    is_active = Column(BOOLEAN, nullable=False, server_default=text("1"))
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"), onupdate=text("CURRENT_TIMESTAMP"))


class Item(Base):
    __tablename__ = "items"
    __table_args__ = (
        UniqueConstraint("serial_number", "item_name", "handler"),
        Index("idx_items_created_at", "created_at"),
        Index("idx_items_status", "status"),
        Index("idx_items_department", "department"),
        Index("idx_items_request_date", "request_date"),
        Index("idx_items_supplier_id", "supplier_id"),
        Index("idx_items_serial_number", "serial_number"),
        Index("idx_items_handler", "handler"),
        Index("idx_items_deleted_at", "deleted_at"),
    )

    id = Column(INTEGER, primary_key=True, autoincrement=True)
    serial_number = Column(TEXT, nullable=False)
    department = Column(TEXT, nullable=False)
    handler = Column(TEXT, nullable=False)
    request_date = Column(TEXT, nullable=False)
    item_name = Column(TEXT, nullable=False)
    quantity = Column(REAL, nullable=False)
    purchase_link = Column(TEXT)
    unit_price = Column(REAL)
    supplier_id = Column(INTEGER, ForeignKey("suppliers.id", ondelete="SET NULL"))
    supplier_name_snapshot = Column(TEXT)
    status = Column(TEXT, nullable=False, server_default=text("'待采购'"))
    invoice_issued = Column(BOOLEAN, server_default=text("0"))
    payment_status = Column(TEXT, nullable=False, server_default=text("'未付款'"))
    arrival_date = Column(TEXT)
    distribution_date = Column(TEXT)
    signoff_note = Column(TEXT)
    deleted_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))


class ItemHistory(Base):
    __tablename__ = "item_history"
    __table_args__ = (
        Index("idx_item_history_created_at", "created_at"),
        Index("idx_item_history_action", "action"),
        Index("idx_item_history_item_id", "item_id"),
    )

    id = Column(INTEGER, primary_key=True, autoincrement=True)
    item_id = Column(INTEGER)
    action = Column(TEXT, nullable=False)
    serial_number = Column(TEXT)
    department = Column(TEXT)
    handler = Column(TEXT)
    item_name = Column(TEXT)
    changed_fields = Column(TEXT)
    before_data = Column(TEXT)
    after_data = Column(TEXT)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("idx_audit_logs_record_id_created_at", "record_id", "created_at"),
        Index("idx_audit_logs_created_at", "created_at"),
    )

    log_id = Column(INTEGER, primary_key=True, autoincrement=True)
    record_id = Column(INTEGER, nullable=False)
    action = Column(TEXT, nullable=False)
    changed_fields = Column(JSON, nullable=False)
    operator_ip = Column(TEXT)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))


AUDIT_FIELD_LABELS = {
    "serial_number": "流水号",
    "department": "申领部门",
    "handler": "经办人",
    "request_date": "申领日期",
    "item_name": "物品名称",
    "quantity": "数量",
    "purchase_link": "采购链接",
    "unit_price": "单价",
    "supplier_id": "供应商 ID",
    "supplier_name_snapshot": "供应商",
    "status": "采购状态",
    "invoice_issued": "发票状态",
    "payment_status": "付款状态",
    "arrival_date": "到货日期",
    "distribution_date": "分发日期",
    "signoff_note": "签收备注",
    "deleted_at": "删除时间",
}


def _to_jsonable(value: Any):
    if isinstance(value, (datetime, date)):
        return value.isoformat(sep=" ")
    if isinstance(value, Decimal):
        return float(value)
    return value


def _insert_audit_log(connection, *, record_id: int | None, action: str, changed_fields: dict) -> None:
    if not record_id:
        return
    connection.execute(
        AuditLog.__table__.insert().values(
            record_id=int(record_id),
            action=action,
            changed_fields=changed_fields,
            operator_ip=get_current_operator_ip(),
        )
    )


@event.listens_for(Item, "after_insert")
def audit_after_insert(mapper, connection, target):  # noqa: ARG001
    changed_fields = {}
    for field, label in AUDIT_FIELD_LABELS.items():
        new_value = _to_jsonable(getattr(target, field, None))
        if new_value is None:
            continue
        changed_fields[label] = {"old": None, "new": new_value}
    if not changed_fields:
        changed_fields = {"记录": {"old": None, "new": "创建"}}
    _insert_audit_log(
        connection,
        record_id=getattr(target, "id", None),
        action="CREATE",
        changed_fields=changed_fields,
    )


@event.listens_for(Item, "after_update")
def audit_after_update(mapper, connection, target):  # noqa: ARG001
    state = inspect(target)
    changed_fields = {}
    action = "UPDATE"
    for field, label in AUDIT_FIELD_LABELS.items():
        attr = state.attrs.get(field)
        if not attr:
            continue
        history = attr.history
        if not history.has_changes():
            continue
        old_value = history.deleted[0] if history.deleted else None
        new_value = history.added[0] if history.added else getattr(target, field, None)
        old_json = _to_jsonable(old_value)
        new_json = _to_jsonable(new_value)
        if old_json == new_json:
            continue
        changed_fields[label] = {"old": old_json, "new": new_json}
        if field == "deleted_at" and old_json is None and new_json is not None:
            action = "DELETE"

    if not changed_fields:
        return

    _insert_audit_log(
        connection,
        record_id=getattr(target, "id", None),
        action=action,
        changed_fields=changed_fields,
    )


@event.listens_for(Item, "after_delete")
def audit_after_delete(mapper, connection, target):  # noqa: ARG001
    changed_fields = {}
    for field, label in AUDIT_FIELD_LABELS.items():
        old_value = _to_jsonable(getattr(target, field, None))
        if old_value is None:
            continue
        changed_fields[label] = {"old": old_value, "new": None}
    if not changed_fields:
        changed_fields = {"记录": {"old": "存在", "new": "删除"}}
    _insert_audit_log(
        connection,
        record_id=getattr(target, "id", None),
        action="DELETE",
        changed_fields=changed_fields,
    )
