from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any

_TERMINAL_STATUSES = {"completed", "failed"}
_UNSET = object()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_iso8601(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


class TaskRegistry:
    """Track short-lived async task state with best-effort pruning."""

    def __init__(
        self,
        *,
        max_tasks: int = 200,
        active_ttl_seconds: int = 6 * 60 * 60,
        terminal_ttl_seconds: int = 30 * 60,
    ) -> None:
        self._tasks: dict[str, dict[str, Any]] = {}
        self._lock = Lock()
        self._max_tasks = max(1, int(max_tasks))
        self._active_ttl_seconds = max(60, int(active_ttl_seconds))
        self._terminal_ttl_seconds = max(60, int(terminal_ttl_seconds))

    def create(self, task_id: str, *, status: str = "pending", result: Any = None) -> None:
        now = _utc_now()
        with self._lock:
            self._tasks[task_id] = self._build_record(status=status, result=result, now=now)
            self._prune_locked(now)

    def update(
        self,
        task_id: str,
        *,
        status: str | None = None,
        result: Any = _UNSET,
    ) -> None:
        now = _utc_now()
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                return
            next_status = str(status or task.get("status") or "pending")
            task["status"] = next_status
            if result is not _UNSET:
                task["result"] = result
            task["updated_at"] = now
            task["expires_at"] = self._resolve_expires_at(next_status, now)
            self._prune_locked(now)

    def get(self, task_id: str) -> dict[str, Any] | None:
        now = _utc_now()
        with self._lock:
            self._prune_locked(now)
            task = self._tasks.get(task_id)
            if task is None:
                return None
            return self._serialize(task)

    def _build_record(self, *, status: str, result: Any, now: datetime) -> dict[str, Any]:
        normalized_status = str(status or "pending")
        return {
            "status": normalized_status,
            "result": result,
            "created_at": now,
            "updated_at": now,
            "expires_at": self._resolve_expires_at(normalized_status, now),
        }

    def _resolve_expires_at(self, status: str, now: datetime) -> datetime:
        ttl_seconds = (
            self._terminal_ttl_seconds
            if str(status or "").lower() in _TERMINAL_STATUSES
            else self._active_ttl_seconds
        )
        return now + timedelta(seconds=ttl_seconds)

    def _prune_locked(self, now: datetime) -> None:
        expired_keys = [
            key
            for key, task in self._tasks.items()
            if task.get("expires_at") <= now
        ]
        for key in expired_keys:
            self._tasks.pop(key, None)

        if len(self._tasks) <= self._max_tasks:
            return

        terminal_keys = sorted(
            (
                key
                for key, task in self._tasks.items()
                if str(task.get("status") or "").lower() in _TERMINAL_STATUSES
            ),
            key=lambda key: (
                self._tasks[key].get("updated_at"),
                self._tasks[key].get("created_at"),
            ),
        )
        for key in terminal_keys:
            if len(self._tasks) <= self._max_tasks:
                break
            self._tasks.pop(key, None)

    def _serialize(self, task: dict[str, Any]) -> dict[str, Any]:
        return {
            "status": task.get("status", "failed"),
            "result": task.get("result"),
            "created_at": _to_iso8601(task["created_at"]),
            "updated_at": _to_iso8601(task["updated_at"]),
            "expires_at": _to_iso8601(task["expires_at"]),
        }
