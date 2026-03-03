from sqlalchemy import BOOLEAN, REAL, INTEGER, TEXT, TIMESTAMP
from sqlalchemy import Column, Index, UniqueConstraint, text
from sqlalchemy.orm import declarative_base


Base = declarative_base()


class Item(Base):
    __tablename__ = "items"
    __table_args__ = (
        UniqueConstraint("serial_number", "item_name", "handler"),
        Index("idx_items_created_at", "created_at"),
        Index("idx_items_status", "status"),
        Index("idx_items_department", "department"),
        Index("idx_items_request_date", "request_date"),
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
