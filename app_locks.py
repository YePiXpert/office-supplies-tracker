import asyncio
import threading

# Shared lock to serialize backup/restore and data mutation operations.
DATA_MUTATION_LOCK = asyncio.Lock()

# Global maintenance flag for restore windows.
MAINTENANCE_MODE = threading.Event()
