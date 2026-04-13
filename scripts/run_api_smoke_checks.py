#!/usr/bin/env python3
from __future__ import annotations

import os
import shutil
import sys
import tempfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


SMOKE_PASSWORD = "smoke-test-password"
SMOKE_ATTACHMENT_BYTES = b"smoke-attachment"


def _expect_status(response, expected_status: int, label: str) -> None:
    if response.status_code != expected_status:
        raise AssertionError(
            f"{label} expected HTTP {expected_status}, got {response.status_code}: {response.text}"
        )


def _find_invoice_row(invoice_queue: list[dict], item_id: int) -> dict:
    for row in invoice_queue:
        if int(row.get("item_id") or 0) == item_id:
            return row
    raise AssertionError(f"Invoice queue row for item {item_id} not found")


def _find_receipt_row(receipt_queue: list[dict], purchase_order_id: int) -> dict:
    for row in receipt_queue:
        if int(row.get("purchase_order_id") or 0) == purchase_order_id:
            return row
    raise AssertionError(f"Receipt queue row for purchase order {purchase_order_id} not found")


def run_smoke_checks() -> None:
    temp_root = Path(tempfile.mkdtemp(prefix="office-supplies-smoke-"))
    try:
        os.environ["OFFICE_SUPPLIES_DATA_DIR"] = str(temp_root / "state" / "data")
        try:
            from fastapi.testclient import TestClient
            from main import app

            with TestClient(app) as client:
                status_response = client.get("/api/auth/status")
                _expect_status(status_response, 200, "auth status before setup")
                status_payload = status_response.json()
                if status_payload.get("initialized"):
                    raise AssertionError("Smoke environment should start uninitialized")

                setup_response = client.post("/api/auth/setup", json={"password": SMOKE_PASSWORD})
                _expect_status(setup_response, 200, "auth setup")

                authed_status = client.get("/api/auth/status")
                _expect_status(authed_status, 200, "auth status after setup")
                authed_payload = authed_status.json()
                if not authed_payload.get("initialized") or not authed_payload.get("authenticated"):
                    raise AssertionError("Auth setup should leave the smoke client authenticated")

                item_payload = {
                    "serial_number": "SMOKE-001",
                    "department": "QA",
                    "handler": "Smoke",
                    "request_date": "2026-04-09",
                    "item_name": "Smoke Notebook",
                    "quantity": 2,
                    "unit_price": 12.5,
                }
                create_item_response = client.post("/api/items", json=item_payload)
                _expect_status(create_item_response, 200, "create item")
                item_id = int(create_item_response.json()["id"])

                list_items_response = client.get("/api/items")
                _expect_status(list_items_response, 200, "list items")
                list_payload = list_items_response.json()
                if int(list_payload.get("total") or 0) < 1:
                    raise AssertionError("Smoke item should be visible in the ledger list")

                update_item_response = client.put(
                    f"/api/items/{item_id}",
                    json={
                        "unit_price": 18.75,
                        "invoice_issued": True,
                    },
                )
                _expect_status(update_item_response, 200, "update item")

                stats_response = client.get("/api/stats")
                _expect_status(stats_response, 200, "stats")
                if int(stats_response.json().get("total") or 0) < 1:
                    raise AssertionError("Stats should reflect the smoke item")

                supplier_response = client.post(
                    "/api/ops/suppliers",
                    json={
                        "name": "Smoke Supplier",
                        "contact_name": "Smoke Buyer",
                        "contact_phone": "123456789",
                    },
                )
                _expect_status(supplier_response, 200, "create supplier")
                supplier_id = int(supplier_response.json()["id"])

                price_response = client.post(
                    "/api/ops/prices",
                    json={
                        "item_name": "Smoke Notebook",
                        "supplier_id": supplier_id,
                        "unit_price": 18.75,
                        "lead_time_days": 3,
                        "last_purchase_date": "2026-04-08",
                    },
                )
                _expect_status(price_response, 200, "create price record")

                inventory_response = client.put(
                    "/api/ops/inventory",
                    json={
                        "item_name": "Smoke Notebook",
                        "current_stock": 1,
                        "low_stock_threshold": 5,
                        "preferred_supplier_id": supplier_id,
                        "reorder_quantity": 6,
                    },
                )
                _expect_status(inventory_response, 200, "save inventory profile")

                purchase_order_response = client.put(
                    f"/api/ops/orders/{item_id}",
                    json={
                        "supplier_id": supplier_id,
                        "ordered_date": "2026-04-09",
                        "expected_arrival_date": "2026-04-12",
                        "status": "ordered",
                        "note": "smoke-order",
                    },
                )
                _expect_status(purchase_order_response, 200, "save purchase order")
                purchase_order_id = int(purchase_order_response.json()["id"])

                ops_center_response = client.get("/api/ops/center")
                _expect_status(ops_center_response, 200, "load operations center")
                ops_center_payload = ops_center_response.json()
                recommendations = ops_center_payload.get("replenishment_recommendations") or []
                if not any(str(row.get("recommended_supplier_name") or "") == "Smoke Supplier" for row in recommendations):
                    raise AssertionError("Replenishment recommendations should carry the recommended supplier")
                if int(ops_center_payload.get("summary", {}).get("pending_receipt_count") or 0) < 1:
                    raise AssertionError("Ops-center summary should include pending receipt count")

                receipt_queue_response = client.get("/api/ops/center")
                _expect_status(receipt_queue_response, 200, "reload ops center before receipt")
                _find_receipt_row(
                    receipt_queue_response.json().get("receipt_queue") or [],
                    purchase_order_id,
                )

                receipt_response = client.put(
                    f"/api/ops/receipts/{purchase_order_id}",
                    json={
                        "received_date": "2026-04-10",
                        "received_quantity": 2,
                        "note": "smoke-receipt",
                    },
                )
                _expect_status(receipt_response, 200, "save purchase receipt")

                invoice_response = client.put(
                    f"/api/ops/invoices/{item_id}",
                    json={
                        "reimbursement_status": "submitted",
                        "reimbursement_date": "2026-04-09",
                        "invoice_number": "SMOKE-INVOICE-001",
                        "note": "smoke",
                    },
                )
                _expect_status(invoice_response, 200, "save invoice record")

                attachment_upload = client.post(
                    f"/api/ops/invoices/{item_id}/attachments",
                    files={
                        "file": (
                            "smoke-attachment.png",
                            SMOKE_ATTACHMENT_BYTES,
                            "image/png",
                        )
                    },
                )
                _expect_status(attachment_upload, 200, "upload invoice attachment")
                attachment_id = int(attachment_upload.json()["id"])

                ops_center_after_attachment = client.get("/api/ops/center")
                _expect_status(ops_center_after_attachment, 200, "reload operations center")
                invoice_row = _find_invoice_row(
                    ops_center_after_attachment.json().get("invoice_queue") or [],
                    item_id,
                )
                attachment_ids = {
                    int(item.get("id") or 0)
                    for item in (invoice_row.get("attachments") or [])
                    if int(item.get("id") or 0) > 0
                }
                if attachment_id not in attachment_ids:
                    raise AssertionError("Uploaded invoice attachment should appear in the ops-center queue")

                attachment_download = client.get(f"/api/ops/invoice-attachments/{attachment_id}/download")
                _expect_status(attachment_download, 200, "download invoice attachment")
                if attachment_download.content != SMOKE_ATTACHMENT_BYTES:
                    raise AssertionError("Downloaded invoice attachment content does not match upload content")

                backup_response = client.get("/api/backup")
                _expect_status(backup_response, 200, "download backup")
                backup_bytes = backup_response.content
                if not backup_bytes:
                    raise AssertionError("Backup download should not be empty")

                backup_health = client.post(
                    "/api/backup/health",
                    files={
                        "file": (
                            "smoke-backup.zip",
                            backup_bytes,
                            "application/zip",
                        )
                    },
                )
                _expect_status(backup_health, 200, "backup health check")
                backup_health_payload = backup_health.json()
                if not backup_health_payload.get("ok"):
                    raise AssertionError("Backup health check should report ok=true")
                if int(backup_health_payload.get("db", {}).get("item_count") or 0) < 1:
                    raise AssertionError("Backup health check should see at least one item")
                if int(backup_health_payload.get("upload_files") or 0) < 1:
                    raise AssertionError("Backup health check should include the uploaded attachment")

                operations_report = client.get("/api/reports/operations")
                _expect_status(operations_report, 200, "operations report")
                ops_payload = operations_report.json()
                status_snapshot = ops_payload.get("status_snapshot") or []
                if not isinstance(status_snapshot, list):
                    raise AssertionError("Operations report should include status_snapshot list")
                total_snapshot_count = sum(int(row.get("record_count") or 0) for row in status_snapshot)
                if total_snapshot_count < 1:
                    raise AssertionError("Operations report status_snapshot should include at least one record")
                if not isinstance(ops_payload.get("funnel"), list):
                    raise AssertionError("Operations report should include funnel list")

                delete_attachment = client.delete(f"/api/ops/invoice-attachments/{attachment_id}")
                _expect_status(delete_attachment, 200, "delete invoice attachment")
        finally:
            os.environ.pop("OFFICE_SUPPLIES_DATA_DIR", None)
    finally:
        shutil.rmtree(temp_root, ignore_errors=True)


def main() -> None:
    run_smoke_checks()
    print("api smoke ok")


if __name__ == "__main__":
    main()
