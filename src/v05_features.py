from __future__ import annotations

import json
import re
import shutil
import time
from collections import Counter
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any

import pymupdf
from docx import Document

from src.config import (
    APP_AUTHOR,
    APP_FULL_NAME,
    APP_VERSION,
    AUTOSAVE_DIR,
    DONATION_URL,
    GITHUB_REPOSITORY,
    PROJECT_FILE_EXTENSIONS,
    PROJECTS_DIR,
    RECENTS_FILE,
    WEBSITE_URL,
)
from src.models import (
    CVProject,
    Certification,
    Education,
    Experience,
    LanguageItem,
    ProjectItem,
    SkillGroup,
    Volunteering,
    create_blank_project,
)
from src.project_manager import safe_filename


TEMPLATE_CATALOG = [
    {
        "id": "ats_classic",
        "name": "ATS Classic",
        "description": "Compact, single-column and text-first.",
        "badges": ["ATS Safe", "1–2 pages", "Color", "Photo optional"],
        "photo": True,
        "ats_safe": True,
    },
    {
        "id": "ats_modern",
        "name": "ATS Modern",
        "description": "More breathing room with a modern hierarchy.",
        "badges": ["ATS Safe", "1–2 pages", "Color", "Photo optional"],
        "photo": True,
        "ats_safe": True,
    },
    {
        "id": "ats_compact",
        "name": "ATS Compact",
        "description": "Maximum information density for one-page CVs.",
        "badges": ["ATS Safe", "1 page", "Compact", "Color"],
        "photo": False,
        "ats_safe": True,
    },
    {
        "id": "executive",
        "name": "Executive",
        "description": "Stronger headings and calmer spacing for senior profiles.",
        "badges": ["ATS Safe", "1–2 pages", "Executive", "Color"],
        "photo": False,
        "ats_safe": True,
    },
]

COUNTRY_PRESETS = {
    "international": {
        "name": "International",
        "photo_recommendation": "optional",
        "date_format": "MM/YYYY",
        "default_cv_language": "en",
        "section_titles": {},
        "notes": "Neutral international defaults.",
    },
    "france": {
        "name": "France",
        "photo_recommendation": "optional",
        "date_format": "MM/YYYY",
        "default_cv_language": "fr",
        "section_titles": {
            "profile": "PROFIL",
            "experiences": "EXPÉRIENCE PROFESSIONNELLE",
            "education": "FORMATION",
            "projects": "PROJETS",
            "volunteering": "BÉNÉVOLAT / VIE ASSOCIATIVE",
            "skills": "COMPÉTENCES TECHNIQUES",
            "languages": "LANGUES",
            "certifications": "CERTIFICATIONS",
        },
        "notes": "French terminology and conventions.",
    },
    "uk": {
        "name": "United Kingdom",
        "photo_recommendation": "avoid",
        "date_format": "MM/YYYY",
        "default_cv_language": "en",
        "section_titles": {
            "experiences": "WORK EXPERIENCE",
        },
        "notes": "Photo discouraged by default.",
    },
    "usa": {
        "name": "United States",
        "photo_recommendation": "avoid",
        "date_format": "MM/YYYY",
        "default_cv_language": "en",
        "section_titles": {
            "profile": "SUMMARY",
            "experiences": "PROFESSIONAL EXPERIENCE",
        },
        "notes": "Résumé-style defaults; photo discouraged.",
    },
    "germany": {
        "name": "Germany",
        "photo_recommendation": "optional",
        "date_format": "MM/YYYY",
        "default_cv_language": "en",
        "section_titles": {},
        "notes": "Neutral German-market preset; English output by default.",
    },
}

WEAK_PHRASES = [
    "responsible for",
    "responsibilities included",
    "helped with",
    "worked on",
    "tasked with",
    "in charge of",
    "assisted with",
    "participated in",
]

ACTION_VERBS = {
    "achieved", "analysed", "analyzed", "automated", "built", "created",
    "delivered", "designed", "developed", "implemented", "improved",
    "increased", "launched", "led", "managed", "monitored", "optimized",
    "produced", "reduced", "reported", "streamlined", "transformed",
    "validated",
}


def _safe_json_read(path: Path, fallback):
    try:
        if not path.exists():
            return fallback
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def _safe_json_write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def completeness_report(project: CVProject) -> dict:
    checks = [
        ("name", bool(project.personal.full_name.strip()), 12, "Add your full name."),
        ("email", bool(project.personal.email.strip()), 8, "Add an email address."),
        ("phone", bool(project.personal.phone.strip()), 4, "Add a phone number."),
        ("target_role", bool(project.personal.target_role.strip()), 8, "Add a target role."),
        ("location", bool(project.personal.location.strip()), 4, "Add your location."),
        ("profile", len(project.profile.split()) >= 18, 10, "Write a concise professional profile."),
        ("experience", bool(project.experiences), 18, "Add at least one professional experience."),
        ("experience_dates", all(
            bool(item.start_date.strip()) and (item.current or bool(item.end_date.strip()))
            for item in project.experiences
        ) if project.experiences else False, 8, "Complete experience dates."),
        ("education", bool(project.education), 10, "Add your education."),
        ("skills", sum(len(group.items) for group in project.skills) >= 5, 10, "Add at least five relevant skills."),
        ("languages", bool(project.languages), 4, "Add at least one language."),
        ("contact_link", bool(
            project.personal.linkedin.strip()
            or project.personal.github.strip()
            or project.personal.website.strip()
        ), 4, "Add LinkedIn, GitHub or a professional website."),
    ]

    total = sum(weight for _, _, weight, _ in checks)
    earned = sum(weight for _, passed, weight, _ in checks if passed)
    score = round(100 * earned / total)
    missing = [
        {"key": key, "message": message, "weight": weight}
        for key, passed, weight, message in checks
        if not passed
    ]
    return {
        "score": score,
        "complete": score == 100,
        "missing": missing,
        "passed": [key for key, passed, _, _ in checks if passed],
    }


def optimizer_report(project: CVProject) -> dict:
    suggestions = []
    pressure = 0

    profile_words = len(project.profile.split())
    if profile_words > 80:
        pressure += 12
        suggestions.append({
            "severity": "high",
            "section": "profile",
            "message": f"Profile uses {profile_words} words. Aim for roughly 40–70 words for a compact one-page CV.",
        })
    elif profile_words > 60:
        pressure += 5
        suggestions.append({
            "severity": "medium",
            "section": "profile",
            "message": f"Profile uses {profile_words} words. Tightening it can recover space.",
        })

    for index, exp in enumerate(project.experiences, start=1):
        bullet_count = len([b for b in exp.bullets if b.strip()])
        if bullet_count > 5:
            pressure += (bullet_count - 5) * 5
            suggestions.append({
                "severity": "high" if bullet_count >= 7 else "medium",
                "section": "experiences",
                "message": f"Experience {index} has {bullet_count} bullets. Keep the strongest 3–5 when targeting one page.",
            })
        long_bullets = [b for b in exp.bullets if len(b.split()) > 28]
        if long_bullets:
            pressure += len(long_bullets) * 3
            suggestions.append({
                "severity": "medium",
                "section": "experiences",
                "message": f"Experience {index} has {len(long_bullets)} long bullet(s) above ~28 words.",
            })

    for index, item in enumerate(project.projects, start=1):
        if len(item.bullets) > 4:
            pressure += 4
            suggestions.append({
                "severity": "medium",
                "section": "projects",
                "message": f"Project {index} has {len(item.bullets)} bullets; 2–4 is usually easier to fit.",
            })

    skill_count = sum(len(group.items) for group in project.skills)
    if skill_count > 28:
        pressure += 8
        suggestions.append({
            "severity": "medium",
            "section": "skills",
            "message": f"{skill_count} skills are listed. Group or remove low-value items if the CV overflows.",
        })

    if project.design.photo_enabled:
        pressure += 5
        suggestions.append({
            "severity": "info",
            "section": "header",
            "message": "The photo consumes header space. Disable it if one-page fitting becomes difficult.",
        })

    return {
        "pressure_score": min(100, pressure),
        "suggestions": suggestions,
        "target_pages": 1 if project.design.page_mode == "1" else 2,
    }


def bullet_quality_report(project: CVProject) -> dict:
    rows = []
    all_bullets = []

    sources = []
    for index, exp in enumerate(project.experiences, start=1):
        for bullet_index, bullet in enumerate(exp.bullets, start=1):
            sources.append(("Experience", index, bullet_index, bullet))
    for index, item in enumerate(project.projects, start=1):
        for bullet_index, bullet in enumerate(item.bullets, start=1):
            sources.append(("Project", index, bullet_index, bullet))
    for index, item in enumerate(project.volunteering, start=1):
        for bullet_index, bullet in enumerate(item.bullets, start=1):
            sources.append(("Volunteering", index, bullet_index, bullet))

    normalized = Counter(
        re.sub(r"\s+", " ", bullet.strip().lower())
        for _, _, _, bullet in sources
        if bullet.strip()
    )

    starters = Counter()

    for section, index, bullet_index, bullet in sources:
        text = bullet.strip()
        if not text:
            continue
        lower = text.lower()
        first_word = re.findall(r"[A-Za-zÀ-ÿ]+", lower)
        first_word = first_word[0] if first_word else ""
        if first_word:
            starters[first_word] += 1

        issues = []
        if any(phrase in lower for phrase in WEAK_PHRASES):
            issues.append("weak_phrase")
        if len(text.split()) > 32:
            issues.append("too_long")
        if len(text.split()) < 5:
            issues.append("too_short")
        if normalized[re.sub(r"\s+", " ", lower)] > 1:
            issues.append("duplicate")
        if not re.search(r"\d|%|€|\$|£", text):
            issues.append("no_measure")
        if first_word and first_word not in ACTION_VERBS:
            issues.append("weak_start")

        rows.append({
            "section": section,
            "item_index": index,
            "bullet_index": bullet_index,
            "text": text,
            "issues": issues,
        })

    repeated_starters = [
        {"word": word, "count": count}
        for word, count in starters.items()
        if count >= 3
    ]

    return {
        "bullets": rows,
        "repeated_starters": repeated_starters,
        "issue_count": sum(len(row["issues"]) for row in rows),
    }


class V05Services:
    def __init__(self) -> None:
        PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
        AUTOSAVE_DIR.mkdir(parents=True, exist_ok=True)

    def template_catalog(self) -> list[dict]:
        return deepcopy(TEMPLATE_CATALOG)

    def country_presets(self) -> dict:
        return deepcopy(COUNTRY_PRESETS)

    def about(self) -> dict:
        return {
            "name": APP_FULL_NAME,
            "version": APP_VERSION,
            "author": APP_AUTHOR,
            "website": WEBSITE_URL,
            "github_repository": GITHUB_REPOSITORY,
            "donation_url": DONATION_URL,
            "privacy": "CV content stays local by default. Internet access is only used for update checks, update downloads, and links you choose to open.",
            "licenses": [
                "pywebview",
                "Jinja2",
                "python-docx",
                "PyMuPDF",
                "Pillow",
                "platformdirs",
            ],
        }

    def recent_projects(self, limit: int = 5) -> list[dict]:
        candidates = []
        seen = set()

        stored = _safe_json_read(RECENTS_FILE, [])
        for path_text in stored:
            path = Path(path_text)
            if path.exists() and path.suffix.lower() in PROJECT_FILE_EXTENSIONS:
                candidates.append(path)
                seen.add(str(path.resolve()))

        for extension in PROJECT_FILE_EXTENSIONS:
            for path in PROJECTS_DIR.glob(f"*{extension}"):
                resolved = str(path.resolve())
                if resolved not in seen:
                    candidates.append(path)
                    seen.add(resolved)

        candidates = sorted(
            candidates,
            key=lambda p: p.stat().st_mtime if p.exists() else 0,
            reverse=True,
        )

        result = []
        for path in candidates[:limit]:
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
                result.append({
                    "path": str(path),
                    "name": path.stem,
                    "title": raw.get("title", path.stem),
                    "person": raw.get("personal", {}).get("full_name", ""),
                    "modified_at": datetime.fromtimestamp(
                        path.stat().st_mtime
                    ).isoformat(timespec="minutes"),
                })
            except Exception:
                continue
        return result

    def remember_project(self, path: Path) -> None:
        existing = _safe_json_read(RECENTS_FILE, [])
        resolved = str(path.resolve())
        values = [resolved] + [
            item for item in existing
            if item != resolved and Path(item).exists()
        ]
        _safe_json_write(RECENTS_FILE, values[:12])

    def recovery_state(self) -> dict:
        candidates = sorted(
            [
                path for path in AUTOSAVE_DIR.iterdir()
                if path.is_file() and path.suffix.lower() in {*PROJECT_FILE_EXTENSIONS, ".json"}
            ],
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )

        if not candidates:
            return {"available": False}

        path = candidates[0]
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            project = CVProject.from_dict(raw)
        except Exception:
            return {"available": False}

        return {
            "available": True,
            "path": str(path),
            "modified_at": datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="minutes"),
            "title": project.title,
            "person": project.personal.full_name,
            "project": project.to_dict(),
        }

    def discard_recovery(self) -> dict:
        removed = 0
        for path in AUTOSAVE_DIR.iterdir():
            if path.is_file() and path.suffix.lower() in {*PROJECT_FILE_EXTENSIONS, ".json"}:
                try:
                    path.unlink()
                    removed += 1
                except OSError:
                    pass
        return {"ok": True, "removed": removed}

    def import_cv(self, path: str) -> dict:
        source = Path(path)
        suffix = source.suffix.lower()
        if suffix not in {".pdf", ".docx"} or not source.exists():
            return {"ok": False, "message": "Choose an existing PDF or DOCX CV."}

        if suffix == ".pdf":
            document = pymupdf.open(source)
            try:
                text = "\n".join(page.get_text("text") for page in document)
            finally:
                document.close()
        else:
            document = Document(source)
            text = "\n".join(
                paragraph.text
                for paragraph in document.paragraphs
                if paragraph.text.strip()
            )

        project = self._heuristic_project(text, source.stem)
        return {
            "ok": True,
            "project": project.to_dict(),
            "source": str(source),
            "warning": (
                "Import is heuristic. Review every field before exporting; "
                "CVM never invents missing experience."
            ),
        }

    def _heuristic_project(self, text: str, title: str) -> CVProject:
        lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
        lines = [line for line in lines if line]
        project = create_blank_project()
        project.title = f"Imported - {title}"

        email = re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", text)
        phone = re.search(r"(?:\+\d{1,3}[\s.-]?)?(?:\d[\s.-]?){8,14}", text)
        linkedin = re.search(r"https?://(?:www\.)?linkedin\.com/\S+", text, flags=re.I)
        github = re.search(r"https?://(?:www\.)?github\.com/\S+", text, flags=re.I)

        if lines:
            first = lines[0]
            if 1 <= len(first.split()) <= 6 and len(first) <= 70:
                project.personal.full_name = first

        if email:
            project.personal.email = email.group(0).rstrip(".,;")
        if phone:
            project.personal.phone = phone.group(0).strip()
        if linkedin:
            project.personal.linkedin = linkedin.group(0).rstrip(".,;")
        if github:
            project.personal.github = github.group(0).rstrip(".,;")

        section_aliases = {
            "profile": {"profile", "summary", "profil", "à propos", "about"},
            "experiences": {
                "experience", "professional experience", "work experience",
                "expérience professionnelle", "experiences professionnelles",
            },
            "education": {"education", "formation", "academic background"},
            "skills": {"skills", "technical skills", "compétences", "competences"},
            "languages": {"languages", "langues"},
            "projects": {"projects", "projets"},
            "certifications": {"certifications", "certificates"},
        }

        current = None
        buckets = {key: [] for key in section_aliases}
        for line in lines[1:]:
            normalized = line.lower().strip(" :")
            found = None
            for key, aliases in section_aliases.items():
                if normalized in aliases:
                    found = key
                    break
            if found:
                current = found
                continue
            if current:
                buckets[current].append(line)

        if buckets["profile"]:
            project.profile = " ".join(buckets["profile"][:4])[:1200]

        if buckets["skills"]:
            tokens = re.split(r"[,|•·;]", " ".join(buckets["skills"]))
            skills = [token.strip() for token in tokens if 1 < len(token.strip()) <= 40]
            project.skills = [SkillGroup(name="Imported skills", items=skills[:35])]

        for line in buckets["languages"][:8]:
            match = re.match(r"(.+?)[\s:–-]+(A1|A2|B1|B2|C1|C2|native|fluent|bilingual|courant|natif)\b", line, re.I)
            if match:
                project.languages.append(
                    LanguageItem(name=match.group(1).strip(), level=match.group(2).upper())
                )

        # Keep raw experience/education text without pretending we know exact structure.
        if buckets["experiences"]:
            project.experiences = [
                Experience(
                    job_title="Imported experience — review",
                    bullets=buckets["experiences"][:12],
                )
            ]
        if buckets["education"]:
            project.education = [
                Education(
                    degree="Imported education — review",
                    details=" | ".join(buckets["education"][:8]),
                )
            ]
        if buckets["projects"]:
            project.projects = [
                ProjectItem(
                    name="Imported projects — review",
                    bullets=buckets["projects"][:10],
                )
            ]
        if buckets["certifications"]:
            project.certifications = [
                Certification(name=value)
                for value in buckets["certifications"][:10]
            ]

        return project
