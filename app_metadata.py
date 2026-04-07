from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent
VERSION_FILE = REPO_ROOT / "VERSION"
APP_VERSION_FALLBACK = "0.0.0"


def load_app_version() -> str:
    try:
        version = VERSION_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        return APP_VERSION_FALLBACK
    return version or APP_VERSION_FALLBACK


APP_VERSION = load_app_version()

