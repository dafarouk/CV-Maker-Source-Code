from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any
import re
import uuid


DEFAULT_SECTION_ORDER = [
    "profile",
    "experiences",
    "education",
    "projects",
    "volunteering",
    "skills",
    "languages",
    "certifications",
]

VALID_SECTION_KEYS = set(DEFAULT_SECTION_ORDER)

DEFAULT_SECTION_VISIBILITY = {
    key: True
    for key in DEFAULT_SECTION_ORDER
}

COLOR_TARGET_KEYS = [
    "name",
    "section_titles",
    "role_titles",
    "subtitles",
    "lines",
    "links",
]

DEFAULT_PRIMARY_TARGETS = [
    "section_titles",
    "lines",
]

DEFAULT_SECONDARY_TARGETS = [
    "name",
]


def new_id() -> str:
    return uuid.uuid4().hex


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def normalize_section_order(value: Any) -> list[str]:
    if not isinstance(value, list):
        value = []

    normalized: list[str] = []

    for item in value:
        key = str(item)

        if (
            key in VALID_SECTION_KEYS
            and key not in normalized
        ):
            normalized.append(key)

    for key in DEFAULT_SECTION_ORDER:
        if key not in normalized:
            normalized.append(key)

    return normalized


def normalize_section_visibility(value: Any) -> dict[str, bool]:
    source = value if isinstance(value, dict) else {}

    return {
        key: bool(source.get(key, True))
        for key in DEFAULT_SECTION_ORDER
    }


def normalize_color_targets(
    value: Any,
    defaults: list[str],
) -> list[str]:
    source = value if isinstance(value, list) else defaults
    normalized: list[str] = []

    for item in source:
        key = str(item)

        if (
            key in COLOR_TARGET_KEYS
            and key not in normalized
        ):
            normalized.append(key)

    return normalized



SPACING_DEFAULTS: dict[str, float] = {
    "page_top_mm": 7.0,
    "page_bottom_mm": 7.0,
    "page_left_mm": 9.0,
    "page_right_mm": 9.0,
    "section_gap_mm": 1.0,
    "title_before_mm": 0.0,
    "title_after_mm": 0.6,
    "separator_gap_mm": 0.2,
    "entry_gap_mm": 1.0,
    "bullet_gap_mm": 0.2,
    "body_line_height": 1.11,
}

for _section in DEFAULT_SECTION_ORDER:
    SPACING_DEFAULTS[f"{_section}_before_mm"] = 0.0
    SPACING_DEFAULTS[f"{_section}_after_mm"] = 0.0
    SPACING_DEFAULTS[f"{_section}_line_height"] = 1.11


SPACING_RANGES: dict[str, tuple[float, float]] = {
    "page_top_mm": (3.0, 25.0),
    "page_bottom_mm": (3.0, 25.0),
    "page_left_mm": (5.0, 25.0),
    "page_right_mm": (5.0, 25.0),
    "section_gap_mm": (0.0, 8.0),
    "title_before_mm": (0.0, 6.0),
    "title_after_mm": (0.0, 6.0),
    "separator_gap_mm": (0.0, 5.0),
    "entry_gap_mm": (0.0, 6.0),
    "bullet_gap_mm": (0.0, 4.0),
    "body_line_height": (0.95, 1.65),
}

for _section in DEFAULT_SECTION_ORDER:
    SPACING_RANGES[f"{_section}_before_mm"] = (0.0, 8.0)
    SPACING_RANGES[f"{_section}_after_mm"] = (0.0, 8.0)
    SPACING_RANGES[f"{_section}_line_height"] = (0.95, 1.65)


def normalize_spacing_settings(value: Any) -> dict[str, float]:
    source = value if isinstance(value, dict) else {}
    normalized: dict[str, float] = {}

    for key, default in SPACING_DEFAULTS.items():
        raw = source.get(key, default)

        try:
            number = float(raw)
        except (TypeError, ValueError):
            number = default

        minimum, maximum = SPACING_RANGES[key]
        normalized[key] = round(
            max(minimum, min(maximum, number)),
            3,
        )

    return normalized


def extract_year_token(value: Any) -> str:
    """Return the last standalone 4-digit year found in a legacy value."""
    matches = re.findall(
        r"(?<!\d)(?:19|20|21)\d{2}(?!\d)",
        str(value or ""),
    )
    return matches[-1] if matches else ""


def project_year_from_legacy(item: dict[str, Any]) -> str:
    """Migrate older project date shapes into CVM 0.6.1's single year field."""
    explicit = extract_year_token(item.get("year"))
    if explicit:
        return explicit

    legacy_date = extract_year_token(item.get("date"))
    if legacy_date:
        return legacy_date

    end_year = extract_year_token(item.get("end_date"))
    if end_year:
        return end_year

    return extract_year_token(item.get("start_date"))


@dataclass
class PersonalInfo:
    full_name: str = ""
    target_role: str = ""
    secondary_target_role: str = ""
    location: str = ""
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    github: str = ""
    website: str = ""


@dataclass
class Experience:
    id: str = field(default_factory=new_id)
    job_title: str = ""
    company: str = ""
    location: str = ""
    start_date: str = ""
    end_date: str = ""
    current: bool = False
    description_mode: str = "bullets"
    paragraph: str = ""
    bullets: list[str] = field(default_factory=list)
    tools: list[str] = field(default_factory=list)


@dataclass
class Education:
    id: str = field(default_factory=new_id)
    degree: str = ""
    school: str = ""
    location: str = ""
    start_date: str = ""
    end_date: str = ""
    details: str = ""


@dataclass
class ProjectItem:
    id: str = field(default_factory=new_id)
    name: str = ""
    subtitle: str = ""

    # CVM 0.6.1: projects use one year only (same UX as certifications).
    year: str = ""

    # Legacy fields remain readable so old .cvproject files are never broken.
    date: str = ""
    start_date: str = ""
    end_date: str = ""
    current: bool = False

    bullets: list[str] = field(default_factory=list)
    tools: list[str] = field(default_factory=list)
    link: str = ""


@dataclass
class Volunteering:
    id: str = field(default_factory=new_id)
    role: str = ""
    organization: str = ""
    location: str = ""
    start_date: str = ""
    end_date: str = ""
    bullets: list[str] = field(default_factory=list)


@dataclass
class SkillGroup:
    id: str = field(default_factory=new_id)
    name: str = ""
    items: list[str] = field(default_factory=list)


@dataclass
class LanguageItem:
    id: str = field(default_factory=new_id)
    name: str = ""
    level: str = ""


@dataclass
class Certification:
    id: str = field(default_factory=new_id)
    name: str = ""
    issuer: str = ""
    year: str = ""
    link: str = ""


@dataclass
class DesignSettings:
    template_id: str = "ats_classic"

    # Compatibility field kept for existing .cvproject files.
    accent_color: str = "#8B1540"

    use_color: bool = True
    primary_color: str = "#8B1540"
    primary_targets: list[str] = field(
        default_factory=lambda: DEFAULT_PRIMARY_TARGETS.copy()
    )

    secondary_color_enabled: bool = False
    secondary_color: str = "#4F46E5"
    secondary_targets: list[str] = field(
        default_factory=lambda: DEFAULT_SECONDARY_TARGETS.copy()
    )

    page_mode: str = "1"
    auto_fit: bool = True

    photo_enabled: bool = False
    photo_path: str = ""

    # "language" is kept for compatibility with CVM 0.4 projects.
    language: str = "en"

    # UI language and generated CV language are independent from CVM 0.5.
    ui_language: str = "en"
    cv_language: str = "en"

    region: str = "international"
    country_preset: str = "international"

    # Optional user-facing section title overrides.
    section_titles: dict[str, str] = field(default_factory=dict)

    # CVM 0.6 spacing editor. Values are normalized/clamped so a bad
    # project file cannot generate impossible page geometry.
    spacing: dict[str, float] = field(
        default_factory=lambda: SPACING_DEFAULTS.copy()
    )

    section_order: list[str] = field(
        default_factory=lambda: DEFAULT_SECTION_ORDER.copy()
    )

    section_visibility: dict[str, bool] = field(
        default_factory=lambda: DEFAULT_SECTION_VISIBILITY.copy()
    )

    def __post_init__(self) -> None:
        self.section_order = normalize_section_order(
            self.section_order
        )

        self.section_visibility = normalize_section_visibility(
            self.section_visibility
        )

        if not self.primary_color:
            self.primary_color = self.accent_color or "#8B1540"

        if not self.accent_color:
            self.accent_color = self.primary_color

        self.accent_color = self.primary_color

        self.primary_targets = normalize_color_targets(
            self.primary_targets,
            DEFAULT_PRIMARY_TARGETS,
        )

        self.secondary_targets = normalize_color_targets(
            self.secondary_targets,
            DEFAULT_SECONDARY_TARGETS,
        )

        # Backward compatibility: old projects used one language field.
        if not self.cv_language:
            self.cv_language = self.language or "en"
        if not self.ui_language:
            self.ui_language = self.language or "en"

        self.language = self.cv_language
        self.cv_language = "fr" if str(self.cv_language).lower().startswith("fr") else "en"
        self.ui_language = "fr" if str(self.ui_language).lower().startswith("fr") else "en"

        if not isinstance(self.section_titles, dict):
            self.section_titles = {}

        self.section_titles = {
            str(key): str(value).strip()
            for key, value in self.section_titles.items()
            if str(key) in VALID_SECTION_KEYS and str(value).strip()
        }

        self.spacing = normalize_spacing_settings(
            self.spacing
        )


@dataclass
class CVProject:
    id: str = field(default_factory=new_id)
    title: str = "Untitled CV"
    created_at: str = field(default_factory=now_iso)
    updated_at: str = field(default_factory=now_iso)

    personal: PersonalInfo = field(default_factory=PersonalInfo)
    profile: str = ""

    experiences: list[Experience] = field(default_factory=list)
    education: list[Education] = field(default_factory=list)
    projects: list[ProjectItem] = field(default_factory=list)
    volunteering: list[Volunteering] = field(default_factory=list)
    skills: list[SkillGroup] = field(default_factory=list)
    languages: list[LanguageItem] = field(default_factory=list)
    certifications: list[Certification] = field(default_factory=list)

    design: DesignSettings = field(default_factory=DesignSettings)

    def touch(self) -> None:
        self.updated_at = now_iso()

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(
        cls,
        data: dict[str, Any],
    ) -> "CVProject":
        design_data = dict(
            data.get("design", {})
        )

        # Backward compatibility with CVM 0.3.x projects.
        if "primary_color" not in design_data:
            design_data["primary_color"] = design_data.get(
                "accent_color",
                "#8B1540",
            )

        design_data["accent_color"] = design_data.get(
            "primary_color",
            design_data.get("accent_color", "#8B1540"),
        )

        design_data["section_order"] = normalize_section_order(
            design_data.get("section_order")
        )

        design_data["section_visibility"] = normalize_section_visibility(
            design_data.get("section_visibility")
        )

        design_data["primary_targets"] = normalize_color_targets(
            design_data.get("primary_targets"),
            DEFAULT_PRIMARY_TARGETS,
        )

        design_data["secondary_targets"] = normalize_color_targets(
            design_data.get("secondary_targets"),
            DEFAULT_SECONDARY_TARGETS,
        )

        legacy_language = design_data.get("language", "en")
        design_data.setdefault("ui_language", legacy_language)
        design_data.setdefault("cv_language", legacy_language)
        design_data.setdefault("country_preset", design_data.get("region", "international"))
        design_data.setdefault("section_titles", {})
        design_data["spacing"] = normalize_spacing_settings(
            design_data.get("spacing")
        )

        project_items = []

        for raw_item in data.get("projects", []):
            item = dict(raw_item)

            # CVM 0.6.1 displays one project year only. Older `date`,
            # `start_date` and `end_date` values are still accepted and
            # migrated without making old project files unreadable.
            item["year"] = project_year_from_legacy(item)

            project_items.append(
                ProjectItem(**item)
            )

        return cls(
            id=data.get("id", new_id()),
            title=data.get("title", "Untitled CV"),
            created_at=data.get("created_at", now_iso()),
            updated_at=data.get("updated_at", now_iso()),
            personal=PersonalInfo(**data.get("personal", {})),
            profile=data.get("profile", ""),
            experiences=[
                Experience(**item)
                for item in data.get("experiences", [])
            ],
            education=[
                Education(**item)
                for item in data.get("education", [])
            ],
            projects=project_items,
            volunteering=[
                Volunteering(**item)
                for item in data.get("volunteering", [])
            ],
            skills=[
                SkillGroup(**item)
                for item in data.get("skills", [])
            ],
            languages=[
                LanguageItem(**item)
                for item in data.get("languages", [])
            ],
            certifications=[
                Certification(**item)
                for item in data.get("certifications", [])
            ],
            design=DesignSettings(**design_data),
        )


def create_blank_project() -> CVProject:
    project = CVProject()

    project.skills = [
        SkillGroup(name="Analysis & BI"),
        SkillGroup(name="Data & SQL"),
        SkillGroup(name="Automation & Tools"),
    ]

    return project


def create_demo_project() -> CVProject:
    project = CVProject(
        title="Demo Data Analyst CV"
    )

    project.personal = PersonalInfo(
        full_name="Alex Morgan",
        target_role="Data Analyst",
        secondary_target_role="Business Intelligence Analyst",
        location="Paris, France",
        email="alex.morgan@example.com",
        phone="+33 6 00 00 00 00",
        linkedin="https://linkedin.com/in/alex-morgan",
        github="https://github.com/alex-morgan",
        website="https://example.com",
    )

    project.profile = (
        "Data Analyst with experience in reporting, KPI monitoring, "
        "dashboard development and business process automation. "
        "Skilled in Power BI, SQL, Excel and Python."
    )

    project.experiences = [
        Experience(
            job_title="Data Analyst",
            company="Example Company",
            location="Paris, France",
            start_date="Jan 2025",
            current=True,
            bullets=[
                "Built operational dashboards to monitor business KPIs and recurring performance trends.",
                "Automated recurring reporting tasks using Python and Excel to reduce manual processing.",
                "Worked with business teams to validate data quality and reporting requirements.",
            ],
            tools=[
                "Power BI",
                "SQL",
                "Python",
                "Excel",
            ],
        )
    ]

    project.education = [
        Education(
            degree="Master's Degree in Data Analytics",
            school="Example University",
            location="Paris, France",
            start_date="2024",
            end_date="2026",
            details=(
                "Business intelligence, data analysis, databases and analytics."
            ),
        )
    ]

    project.projects = [
        ProjectItem(
            name="Sales Performance Dashboard",
            subtitle="Personal analytics project",
            year="2026",
            bullets=[
                "Created an interactive dashboard to analyse revenue, products and regional performance."
            ],
            tools=[
                "Power BI",
                "SQL",
            ],
        )
    ]

    project.skills = [
        SkillGroup(
            name="Analysis & BI",
            items=[
                "Power BI",
                "Excel",
                "Tableau",
                "KPI",
                "Reporting",
            ],
        ),
        SkillGroup(
            name="Data & SQL",
            items=[
                "SQL",
                "Python",
                "MySQL",
                "Data Quality",
                "Data Modelling",
            ],
        ),
        SkillGroup(
            name="Automation & Tools",
            items=[
                "VBA",
                "Power Automate",
                "Git",
                "Jira",
            ],
        ),
    ]

    project.languages = [
        LanguageItem(name="English", level="C1"),
        LanguageItem(name="French", level="C1"),
    ]

    project.certifications = [
        Certification(
            name="Power BI Certification",
            issuer="Example",
            year="2026",
        )
    ]

    return project
