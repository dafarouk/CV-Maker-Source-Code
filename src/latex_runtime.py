from __future__ import annotations

import os
import shutil
from pathlib import Path

from src.config import (
    BUNDLED_TECTONIC,
    TECTONIC_BUNDLE_URL,
    TECTONIC_CACHE_DIR,
)


def _cache_has_files() -> bool:
    if not TECTONIC_CACHE_DIR.exists():
        return False

    try:
        return any(path.is_file() for path in TECTONIC_CACHE_DIR.rglob("*"))
    except OSError:
        return False


def bundled_tectonic_ready() -> bool:
    return BUNDLED_TECTONIC.exists() and _cache_has_files()


def available_latex_engine() -> str | None:
    """
    Prefer CVM's bundled offline Tectonic runtime in public builds.
    Developer machines may fall back to an installed LaTeX engine.
    """
    if bundled_tectonic_ready():
        return str(BUNDLED_TECTONIC)

    for executable in (
        "pdflatex",
        "xelatex",
        "lualatex",
        "tectonic",
    ):
        path = shutil.which(executable)
        if path:
            return path

    return None


def is_bundled_tectonic(engine: str | Path) -> bool:
    try:
        return (
            bundled_tectonic_ready()
            and Path(engine).resolve() == BUNDLED_TECTONIC.resolve()
        )
    except OSError:
        return False


def build_compile_environment(engine: str | Path) -> dict[str, str]:
    """Return the environment required by the selected LaTeX engine."""
    env = os.environ.copy()

    if is_bundled_tectonic(engine):
        env["TECTONIC_CACHE_DIR"] = str(TECTONIC_CACHE_DIR)

    return env


def build_compile_command(
    engine: str,
    input_name: str,
    output_directory: Path,
    *,
    no_shell_escape: bool = True,
) -> list[str]:
    engine_name = Path(engine).stem.lower()

    if engine_name == "tectonic":
        command = [engine]

        if is_bundled_tectonic(engine):
            command.extend(
                [
                    "--bundle",
                    TECTONIC_BUNDLE_URL,
                    "--only-cached",
                ]
            )

        command.extend(
            [
                "--keep-logs",
                "--outdir",
                str(output_directory),
                input_name,
            ]
        )

        return command

    command = [engine]

    if no_shell_escape:
        command.append("-no-shell-escape")

    command.extend(
        [
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-file-line-error",
            input_name,
        ]
    )

    return command
