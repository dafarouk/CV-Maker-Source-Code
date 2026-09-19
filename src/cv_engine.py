from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import re

from jinja2 import Environment, FileSystemLoader

from src.config import LATEX_TEMPLATES_DIR
from src.design_utils import (
    section_enabled,
    target_hex_no_hash,
    valid_photo_path,
)
from src.models import CVProject, normalize_spacing_settings
from src.i18n import normalize_language, tr


LATEX_REPLACEMENTS = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


MONTHS = {
    "en": [
        "",
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ],
    "fr": [
        "",
        "Janvier",
        "Février",
        "Mars",
        "Avril",
        "Mai",
        "Juin",
        "Juillet",
        "Août",
        "Septembre",
        "Octobre",
        "Novembre",
        "Décembre",
    ],
}


MONTH_ALIASES = {
    "jan": 1, "january": 1, "janvier": 1,
    "feb": 2, "february": 2, "février": 2, "fevrier": 2, "fév": 2, "fev": 2,
    "mar": 3, "march": 3, "mars": 3,
    "apr": 4, "april": 4, "avril": 4, "avr": 4,
    "may": 5, "mai": 5,
    "jun": 6, "june": 6, "juin": 6,
    "jul": 7, "july": 7, "juillet": 7, "juil": 7,
    "aug": 8, "august": 8, "août": 8, "aout": 8,
    "sep": 9, "sept": 9, "september": 9, "septembre": 9,
    "oct": 10, "october": 10, "octobre": 10,
    "nov": 11, "november": 11, "novembre": 11,
    "dec": 12, "december": 12, "décembre": 12, "decembre": 12,
}


def escape_latex(value) -> str:
    if value is None:
        return ""

    return "".join(
        LATEX_REPLACEMENTS.get(character, character)
        for character in str(value)
    )


def clean_url(value) -> str:
    if not value:
        return ""

    return (
        str(value)
        .replace("\\", "")
        .replace("{", "")
        .replace("}", "")
        .strip()
    )


def clean_path_for_latex(value) -> str:
    if not value:
        return ""

    return str(Path(value).resolve()).replace("\\", "/")


def parse_month_year(value: str) -> tuple[int | None, int | None]:
    """
    Normalize the date formats CVM has used historically.

    Accepted examples:
    - 06/2026
    - 06//2026   (old typo is repaired)
    - 2026-06
    - June 2026 / Jun 2026
    - Juin 2026
    - 2026
    """
    text = str(value or "").strip()

    if not text:
        return None, None

    text = re.sub(r"/+", "/", text)

    match = re.fullmatch(r"(0?[1-9]|1[0-2])\s*/\s*(\d{4})", text)
    if match:
        return int(match.group(2)), int(match.group(1))

    match = re.fullmatch(r"(\d{4})\s*[-/]\s*(0?[1-9]|1[0-2])", text)
    if match:
        return int(match.group(1)), int(match.group(2))

    match = re.fullmatch(r"(\d{4})", text)
    if match:
        return int(match.group(1)), None

    match = re.fullmatch(
        r"([A-Za-zÀ-ÿ.]+)\s+(\d{4})",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        month_token = (
            match.group(1)
            .lower()
            .rstrip(".")
        )
        month = MONTH_ALIASES.get(month_token)

        if month:
            return int(match.group(2)), month

    return None, None


def format_month_year(
    value: str,
    language: str = "en",
) -> str:
    language = normalize_language(language)
    year, month = parse_month_year(value)

    if year is None:
        return str(value or "").strip()

    if month is None:
        return str(year)

    return f"{MONTHS[language][month]} {year}"


def format_date_range(
    start: str,
    end: str,
    *,
    current: bool = False,
    language: str = "en",
    present_label: str = "Present",
) -> str:
    language = normalize_language(language)

    start_year, start_month = parse_month_year(start)

    if current:
        start_label = format_month_year(start, language)

        if start_label:
            return f"{start_label} - {present_label}"

        return present_label

    end_year, end_month = parse_month_year(end)

    if start_year is None and end_year is None:
        start_text = str(start or "").strip()
        end_text = str(end or "").strip()

        if start_text and end_text:
            return f"{start_text} - {end_text}"

        return start_text or end_text

    if start_year is not None and end_year is None:
        return format_month_year(start, language)

    if start_year is None and end_year is not None:
        return format_month_year(end, language)

    if (
        start_year == end_year
        and start_month is not None
        and end_month is not None
    ):
        if start_month == end_month:
            return f"{MONTHS[language][start_month]} {start_year}"

        return (
            f"{MONTHS[language][start_month]}"
            f" - "
            f"{MONTHS[language][end_month]} "
            f"{start_year}"
        )

    if (
        start_year == end_year
        and start_month is None
        and end_month is None
    ):
        return str(start_year)

    return (
        f"{format_month_year(start, language)}"
        f" - "
        f"{format_month_year(end, language)}"
    )


def date_range(
    start: str,
    end: str,
    current: bool = False,
    present_label: str = "Present",
    language: str = "en",
) -> str:
    """Backward-compatible public helper used by older CVM code."""
    return format_date_range(
        start,
        end,
        current=current,
        language=language,
        present_label=present_label,
    )


def _spacing_context(
    project: CVProject,
    compact_level: int,
) -> dict[str, float]:
    base = normalize_spacing_settings(
        getattr(project.design, "spacing", {})
    )

    level = max(0, min(3, int(compact_level)))
    density = (1.0, 0.86, 0.72, 0.58)[level]

    result = dict(base)

    # Auto-fit is allowed to compact the user's chosen spacing, but the
    # user's proportions remain intact.
    for key in (
        "section_gap_mm",
        "title_before_mm",
        "title_after_mm",
        "separator_gap_mm",
        "entry_gap_mm",
        "bullet_gap_mm",
    ):
        result[key] = round(base[key] * density, 3)

    for section in (
        "profile",
        "experiences",
        "education",
        "projects",
        "volunteering",
        "skills",
        "languages",
        "certifications",
    ):
        for suffix in ("before_mm", "after_mm"):
            key = f"{section}_{suffix}"
            result[key] = round(base[key] * density, 3)

    # Keep page margins user-controlled but let auto-fit reclaim a small,
    # bounded amount of space at higher compact levels.
    margin_reduction = (0.0, 0.7, 1.2, 1.7)[level]
    result["page_top_mm"] = max(3.0, base["page_top_mm"] - margin_reduction)
    result["page_bottom_mm"] = max(3.0, base["page_bottom_mm"] - margin_reduction)
    result["page_left_mm"] = max(5.0, base["page_left_mm"] - margin_reduction)
    result["page_right_mm"] = max(5.0, base["page_right_mm"] - margin_reduction)

    template_id = project.design.template_id or "ats_classic"
    body_font = {
        "ats_classic": 8.2,
        "ats_modern": 8.2,
        "ats_compact": 7.8,
        "executive": 8.2,
    }.get(template_id, 8.2)

    compact_font_delta = (0.0, 0.15, 0.30, 0.45)[level]
    body_font = max(7.4, body_font - compact_font_delta)

    result["body_font_pt"] = round(body_font, 2)
    result["body_baseline_pt"] = round(
        body_font * base["body_line_height"],
        2,
    )

    for section, font_size in {
        "profile": 8.2,
        "experiences": 8.15,
        "education": 7.9,
        "projects": 8.15,
        "volunteering": 8.15,
        "skills": 8.0,
        "languages": 8.0,
        "certifications": 7.9,
    }.items():
        result[f"{section}_baseline_pt"] = round(
            font_size * base[f"{section}_line_height"],
            2,
        )

    return result


class CVEngine:
    def __init__(self) -> None:
        self.environment = Environment(
            loader=FileSystemLoader(
                str(LATEX_TEMPLATES_DIR)
            ),
            autoescape=False,
            trim_blocks=True,
            lstrip_blocks=True,
            block_start_string="[%",
            block_end_string="%]",
            variable_start_string="[[",
            variable_end_string="]]",
            comment_start_string="[#",
            comment_end_string="#]",
        )

        self.environment.filters["tex"] = escape_latex
        self.environment.filters["url"] = clean_url
        self.environment.filters["path"] = clean_path_for_latex

    def _context(
        self,
        project: CVProject,
        compact_level: int = 0,
    ) -> dict:
        data = deepcopy(
            project.to_dict()
        )

        personal = data["personal"]
        design = project.design
        language = normalize_language(
            getattr(design, "cv_language", "")
            or design.language
        )

        labels = {
            key: tr(language, key)
            for key in (
                "profile",
                "experience",
                "education",
                "projects",
                "volunteering",
                "skills",
                "languages",
                "certifications",
                "present",
                "tools",
                "project_link",
            )
        }

        custom_titles = getattr(
            design,
            "section_titles",
            {},
        ) or {}

        title_key_map = {
            "profile": "profile",
            "experiences": "experience",
            "education": "education",
            "projects": "projects",
            "volunteering": "volunteering",
            "skills": "skills",
            "languages": "languages",
            "certifications": "certifications",
        }

        for section_key, label_key in title_key_map.items():
            custom_value = str(
                custom_titles.get(
                    section_key,
                    "",
                )
            ).strip()

            if custom_value:
                labels[label_key] = custom_value

        header_contacts = []

        if personal.get("location"):
            header_contacts.append(
                {
                    "text": personal["location"],
                    "url": "",
                }
            )

        if personal.get("email"):
            header_contacts.append(
                {
                    "text": personal["email"],
                    "url": "mailto:" + personal["email"],
                }
            )

        if personal.get("phone"):
            header_contacts.append(
                {
                    "text": personal["phone"],
                    "url": "",
                }
            )

        if personal.get("linkedin"):
            header_contacts.append(
                {
                    "text": "LinkedIn",
                    "url": personal["linkedin"],
                }
            )

        if personal.get("github"):
            header_contacts.append(
                {
                    "text": "GitHub",
                    "url": personal["github"],
                }
            )

        if personal.get("website"):
            header_contacts.append(
                {
                    "text": "Website",
                    "url": personal["website"],
                }
            )

        for experience in data["experiences"]:
            experience["date_range"] = format_date_range(
                experience.get("start_date", ""),
                experience.get("end_date", ""),
                current=experience.get("current", False),
                language=language,
                present_label=labels["present"],
            )

        for education in data["education"]:
            education["date_range"] = format_date_range(
                education.get("start_date", ""),
                education.get("end_date", ""),
                language=language,
                present_label=labels["present"],
            )

        for item in data["projects"]:
            # CVM 0.6.1: projects intentionally display one year only.
            project_year = str(item.get("year", "") or "").strip()

            if not project_year:
                # Backward compatibility for older project files.
                legacy_values = (
                    item.get("date", ""),
                    item.get("end_date", ""),
                    item.get("start_date", ""),
                )

                for legacy_value in legacy_values:
                    legacy_year, _legacy_month = parse_month_year(
                        legacy_value
                    )

                    if legacy_year is not None:
                        project_year = str(legacy_year)
                        break

            item["date_range"] = project_year

        for volunteering in data["volunteering"]:
            volunteering["date_range"] = format_date_range(
                volunteering.get("start_date", ""),
                volunteering.get("end_date", ""),
                language=language,
                present_label=labels["present"],
            )

        data["language"] = language
        data["labels"] = labels
        data["spacing"] = _spacing_context(
            project,
            compact_level,
        )

        data["color_name_hex"] = target_hex_no_hash(
            design,
            "name",
        )
        data["color_section_hex"] = target_hex_no_hash(
            design,
            "section_titles",
        )
        data["color_role_hex"] = target_hex_no_hash(
            design,
            "role_titles",
        )
        data["color_subtitle_hex"] = target_hex_no_hash(
            design,
            "subtitles",
        )
        data["color_line_hex"] = target_hex_no_hash(
            design,
            "lines",
        )
        data["color_link_hex"] = target_hex_no_hash(
            design,
            "links",
        )

        data["header_contacts"] = header_contacts
        data["compact_level"] = max(
            0,
            min(3, int(compact_level)),
        )

        photo = valid_photo_path(
            design
        )

        data["photo_path"] = (
            str(photo.resolve())
            if photo
            else ""
        )
        data["photo_enabled"] = bool(photo)

        data["section_visibility"] = {
            key: section_enabled(
                design,
                key,
            )
            for key in design.section_order
        }

        return data

    def render_latex(
        self,
        project: CVProject,
        compact_level: int = 0,
    ) -> str:
        template_id = (
            project.design.template_id
            or "ats_classic"
        )

        template = self.environment.get_template(
            f"{template_id}.tex.j2"
        )

        return template.render(
            **self._context(
                project,
                compact_level=compact_level,
            )
        )

    def plain_text(
        self,
        project: CVProject,
    ) -> str:
        chunks: list[str] = []
        personal = project.personal

        chunks.extend(
            [
                personal.full_name,
                personal.target_role,
                personal.secondary_target_role,
                project.profile,
            ]
        )

        for experience in project.experiences:
            chunks.extend(
                [
                    experience.job_title,
                    experience.company,
                    experience.location,
                    experience.paragraph,
                    *experience.bullets,
                    *experience.tools,
                ]
            )

        for education in project.education:
            chunks.extend(
                [
                    education.degree,
                    education.school,
                    education.details,
                ]
            )

        for item in project.projects:
            chunks.extend(
                [
                    item.name,
                    item.subtitle,
                    *item.bullets,
                    *item.tools,
                ]
            )

        for item in project.volunteering:
            chunks.extend(
                [
                    item.role,
                    item.organization,
                    *item.bullets,
                ]
            )

        for group in project.skills:
            chunks.extend(
                [
                    group.name,
                    *group.items,
                ]
            )

        for item in project.languages:
            chunks.extend(
                [
                    item.name,
                    item.level,
                ]
            )

        for item in project.certifications:
            chunks.extend(
                [
                    item.name,
                    item.issuer,
                ]
            )

        return "\n".join(
            str(chunk)
            for chunk in chunks
            if chunk
        )
