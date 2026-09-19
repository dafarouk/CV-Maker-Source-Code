from __future__ import annotations

import json
import os
import re
from pathlib import Path

from src.config import (
    AUTOSAVE_DIR,
    PROJECT_EXTENSION,
    PROJECT_FORMAT_ID,
    PROJECT_SCHEMA_VERSION,
    PROJECTS_DIR,
)
from src.models import CVProject


def safe_filename(value: str) -> str:
    value = value.strip() or "Untitled CV"

    value = re.sub(
        r'[<>:"/\\|?*]',
        "",
        value,
    )

    value = re.sub(
        r"\s+",
        " ",
        value,
    )

    return value[:100].strip()


def _project_payload(project: CVProject) -> dict:
    """Return a normal CVProject payload with a small CVM format marker."""
    data = project.to_dict()
    data["_cvm"] = {
        "format": PROJECT_FORMAT_ID,
        "schema_version": PROJECT_SCHEMA_VERSION,
    }
    return data


class ProjectManager:
    def default_path(
        self,
        project: CVProject,
    ) -> Path:
        return (
            PROJECTS_DIR
            / (
                safe_filename(project.title)
                + PROJECT_EXTENSION
            )
        )

    def save(
        self,
        project: CVProject,
        path: str | Path | None = None,
    ) -> Path:
        project.touch()

        target = (
            Path(path)
            if path
            else self.default_path(project)
        )

        # New saves always use the native .cvm extension. If an older
        # .cvproject file was opened, the next Save migrates it safely.
        if target.suffix.lower() != PROJECT_EXTENSION:
            target = target.with_suffix(
                PROJECT_EXTENSION
            )

        target.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        temporary = target.with_suffix(
            target.suffix + ".tmp"
        )

        with temporary.open(
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                _project_payload(project),
                file,
                ensure_ascii=False,
                indent=2,
            )

        os.replace(
            temporary,
            target,
        )

        return target

    def autosave(
        self,
        project: CVProject,
    ) -> Path:
        project.touch()

        target = (
            AUTOSAVE_DIR
            / (
                project.id
                + PROJECT_EXTENSION
            )
        )

        target.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        temporary = target.with_suffix(
            target.suffix + ".tmp"
        )

        with temporary.open(
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                _project_payload(project),
                file,
                ensure_ascii=False,
                indent=2,
            )

        os.replace(
            temporary,
            target,
        )

        return target

    def load(
        self,
        path: str | Path,
    ) -> CVProject:
        path = Path(path)

        with path.open(
            "r",
            encoding="utf-8",
        ) as file:
            data = json.load(file)

        if not isinstance(data, dict):
            raise ValueError("This is not a valid CV Maker project file.")

        return CVProject.from_dict(data)
