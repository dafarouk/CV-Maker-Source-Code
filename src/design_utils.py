from __future__ import annotations

from pathlib import Path
import re

from src.models import DesignSettings


INK_HEX = "111827"


def normalize_hex(value: str, fallback: str = "#8B1540") -> str:
    value = str(value or "").strip()

    if not value.startswith("#"):
        value = f"#{value}"

    if not re.fullmatch(r"#[0-9A-Fa-f]{6}", value):
        value = fallback

    return value.upper()


def target_color(
    design: DesignSettings,
    target: str,
    *,
    fallback: str = "#111827",
) -> str:
    if not design.use_color:
        return normalize_hex(fallback, "#111827")

    primary = normalize_hex(
        design.primary_color or design.accent_color,
        "#8B1540",
    )

    secondary = normalize_hex(
        design.secondary_color,
        "#4F46E5",
    )

    if (
        design.secondary_color_enabled
        and target in design.secondary_targets
    ):
        return secondary

    if target in design.primary_targets:
        return primary

    return normalize_hex(fallback, "#111827")


def target_hex_no_hash(
    design: DesignSettings,
    target: str,
    *,
    fallback: str = "#111827",
) -> str:
    return target_color(
        design,
        target,
        fallback=fallback,
    ).replace("#", "")


def section_enabled(
    design: DesignSettings,
    section_key: str,
) -> bool:
    return bool(
        design.section_visibility.get(
            section_key,
            True,
        )
    )


def valid_photo_path(design: DesignSettings) -> Path | None:
    if not design.photo_enabled:
        return None

    path = Path(
        design.photo_path or ""
    )

    if (
        not path.exists()
        or not path.is_file()
        or path.suffix.lower() not in {".png", ".jpg", ".jpeg"}
    ):
        return None

    return path
