from __future__ import annotations

import sys
from pathlib import Path

from src.bridge import AppBridge
from src.config import (
    PROJECT_FILE_EXTENSIONS,
    ensure_runtime_directories,
)
from src.startup import launch_application


def _startup_project_from_args() -> Path | None:
    if len(sys.argv) < 2:
        return None

    raw = str(sys.argv[1] or "").strip().strip('"')
    if not raw:
        return None

    candidate = Path(raw).expanduser()

    if (
        candidate.exists()
        and candidate.is_file()
        and candidate.suffix.lower() in PROJECT_FILE_EXTENSIONS
    ):
        return candidate.resolve()

    return None


def main() -> None:
    ensure_runtime_directories()

    bridge = AppBridge()

    startup_project = _startup_project_from_args()
    if startup_project is not None:
        result = bridge.load_project_path(
            str(startup_project)
        )
        bridge.mark_startup_project_loaded(
            bool(result.get("ok"))
        )

    launch_application(
        bridge
    )


if __name__ == "__main__":
    main()
