import asyncio
import threading

# Shared lock to serialize backup/restore and data mutation operations.
# Lazily initialized inside the running event loop to avoid binding to a
# loop that was not yet started at import time (Python 3.10+).
_DATA_MUTATION_LOCK: asyncio.Lock | None = None


def get_data_mutation_lock() -> asyncio.Lock:
    global _DATA_MUTATION_LOCK
    if _DATA_MUTATION_LOCK is None:
        _DATA_MUTATION_LOCK = asyncio.Lock()
    return _DATA_MUTATION_LOCK


# Backwards-compatible module-level alias resolved lazily via __getattr__.
def __getattr__(name: str):
    if name == "DATA_MUTATION_LOCK":
        return get_data_mutation_lock()
    raise AttributeError(f"module 'app_locks' has no attribute {name!r}")


# Global maintenance flag for restore windows.
MAINTENANCE_MODE = threading.Event()
