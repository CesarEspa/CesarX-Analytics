"""Small in-memory TTL cache — no external dependency, no locking.

Scoped to a single process: fine for a single Render instance running one
uvicorn worker. If this service is ever scaled to multiple workers/instances,
each would hold its own cache (not shared), which is an acceptable trade-off
for its current purpose (capping repeat calls to metered NewsAPI/Claude).
"""

import time
from typing import Any


class TTLCache:
    def __init__(self, ttl_seconds: float):
        self._ttl_seconds = ttl_seconds
        self._store: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.time() > expires_at:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (value, time.time() + self._ttl_seconds)
