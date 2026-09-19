from __future__ import annotations

import re
from collections import Counter
from typing import Any

from src.design_utils import section_enabled, valid_photo_path
from src.models import CVProject


ACTION_VERBS = {
    "analysed", "analyzed", "automated", "built", "created",
    "developed", "designed", "implemented", "improved", "managed",
    "monitored", "optimized", "produced", "reduced", "reported",
    "streamlined", "validated", "coordinated", "delivered", "identified",
    "measured", "transformed", "maintained", "supported", "led",
}

STANDARD_SECTIONS = {
    "profile",
    "experiences",
    "education",
    "projects",
    "volunteering",
    "skills",
    "languages",
    "certifications",
}

SUSPICIOUS_GLYPHS = {
    "★", "☆", "◆", "◇", "●", "○", "►", "▶", "✓", "✔", "✦", "✧",
}


def _words(text: str) -> list[str]:
    return re.findall(
        r"[A-Za-zÀ-ÿ0-9+#.\-]+",
        (text or "").lower(),
    )


def _emails(text: str) -> list[str]:
    return re.findall(
        r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
        text or "",
    )


def _all_cv_text(project: CVProject) -> str:
    chunks = [
        project.personal.full_name,
        project.personal.target_role,
        project.personal.secondary_target_role,
        project.personal.location,
        project.personal.email,
        project.personal.phone,
        project.profile,
    ]

    for item in project.experiences:
        chunks.extend([
            item.job_title,
            item.company,
            item.location,
            item.paragraph,
            *item.bullets,
            *item.tools,
        ])

    for item in project.education:
        chunks.extend([
            item.degree,
            item.school,
            item.location,
            item.details,
        ])

    for item in project.projects:
        chunks.extend([
            item.name,
            item.subtitle,
            *item.bullets,
            *item.tools,
        ])

    for item in project.volunteering:
        chunks.extend([
            item.role,
            item.organization,
            *item.bullets,
        ])

    for group in project.skills:
        chunks.extend([group.name, *group.items])

    for item in project.languages:
        chunks.extend([item.name, item.level])

    for item in project.certifications:
        chunks.extend([item.name, item.issuer, item.year])

    return "\n".join(str(value) for value in chunks if value)


def run_ats_check(
    project: CVProject,
    pdf_audit: dict[str, Any] | None = None,
) -> dict:
    deductions = 0
    issues: list[str] = []
    warnings: list[str] = []
    passed: list[str] = []
    technical: list[str] = []

    personal = project.personal
    full_text = _all_cv_text(project)

    # --------------------------------------------------------
    # CONTACT / IDENTITY
    # --------------------------------------------------------

    if personal.full_name.strip():
        passed.append("Candidate name is present.")
    else:
        deductions += 14
        issues.append("Add your full name.")

    if personal.email.strip():
        if _emails(personal.email):
            passed.append("Email address has a recognisable format.")
        else:
            deductions += 5
            issues.append("The email address format looks invalid.")
    else:
        deductions += 9
        issues.append("Add an email address.")

    if personal.phone.strip():
        digits = re.sub(r"\D", "", personal.phone)

        if len(digits) >= 8:
            passed.append("Phone number is present.")
        else:
            deductions += 3
            warnings.append("Phone number looks unusually short.")
    else:
        deductions += 3
        warnings.append("Phone number is missing.")

    if personal.target_role.strip():
        passed.append("A target role is clearly stated.")
    else:
        deductions += 4
        warnings.append("Add a clear target role near the top of the CV.")

    # --------------------------------------------------------
    # CONTENT STRUCTURE
    # --------------------------------------------------------

    profile_words = len(_words(project.profile))

    if project.profile and section_enabled(project.design, "profile"):
        if 18 <= profile_words <= 90:
            passed.append("Profile length is concise and readable.")
        elif profile_words > 90:
            deductions += 3
            warnings.append("Profile is long; aim for roughly 2–5 concise lines.")
        else:
            deductions += 2
            warnings.append("Profile is very short and may not communicate enough context.")

    if project.experiences and section_enabled(project.design, "experiences"):
        passed.append("Professional experience section is present.")
    else:
        deductions += 10
        warnings.append("No visible professional experience section is present.")

    if project.education and section_enabled(project.design, "education"):
        passed.append("Education section is present.")
    else:
        deductions += 4
        warnings.append("Education section is empty or hidden.")

    skill_count = sum(len(group.items) for group in project.skills)

    if skill_count >= 5 and section_enabled(project.design, "skills"):
        passed.append("Technical skills are explicitly listed.")
    elif skill_count:
        deductions += 3
        warnings.append("The visible skills section is relatively sparse.")
    else:
        deductions += 7
        issues.append("Technical skills section is empty.")

    # --------------------------------------------------------
    # BULLETS / IMPACT / REPETITION
    # --------------------------------------------------------

    all_bullets: list[str] = []
    long_bullets = 0
    very_short_bullets = 0
    action_verb_misses = 0
    quantified_bullets = 0

    for experience in project.experiences:
        if not experience.job_title.strip():
            deductions += 2
            issues.append("An experience is missing its job title.")

        if not experience.company.strip():
            deductions += 2
            issues.append("An experience is missing its company name.")

        if not experience.start_date.strip():
            deductions += 1
            warnings.append("An experience is missing its start date.")

        for bullet in experience.bullets:
            bullet = bullet.strip()

            if not bullet:
                continue

            all_bullets.append(bullet)
            word_count = len(_words(bullet))

            if word_count > 38:
                long_bullets += 1

            if 0 < word_count < 6:
                very_short_bullets += 1

            bullet_words = _words(bullet)

            if bullet_words and bullet_words[0] not in ACTION_VERBS:
                action_verb_misses += 1

            if re.search(r"\b\d+(?:[.,]\d+)?\s*(?:%|€|\$|£|k|m|hours?|days?|users?|reports?|dashboards?|records?|files?)?\b", bullet, re.I):
                quantified_bullets += 1

    if long_bullets:
        deductions += min(6, long_bullets)
        warnings.append(f"{long_bullets} experience bullet(s) are long and may scan poorly.")

    if very_short_bullets:
        deductions += min(4, very_short_bullets)
        warnings.append(f"{very_short_bullets} experience bullet(s) are extremely short.")

    if action_verb_misses and all_bullets:
        warnings.append(
            f"{action_verb_misses} experience bullet(s) do not begin with one of CVM's recognised action verbs."
        )
    elif all_bullets:
        passed.append("Experience bullets generally start with clear action verbs.")

    if quantified_bullets:
        passed.append(f"{quantified_bullets} experience bullet(s) contain measurable evidence.")
    elif all_bullets:
        warnings.append("No measurable results were detected in experience bullets; add numbers only where they are real.")

    normalized_bullets = [
        re.sub(r"\W+", " ", bullet.lower()).strip()
        for bullet in all_bullets
    ]

    duplicates = len(normalized_bullets) - len(set(normalized_bullets))

    if duplicates:
        deductions += min(6, duplicates * 2)
        warnings.append(f"{duplicates} duplicated experience bullet(s) detected.")
    elif normalized_bullets:
        passed.append("No identical experience bullets were detected.")

    # Repeated leading verbs can make a CV read mechanically.
    first_words = [
        words[0]
        for bullet in all_bullets
        if (words := _words(bullet))
    ]

    repeated_starts = [
        word
        for word, count in Counter(first_words).items()
        if count >= 3
    ]

    if repeated_starts:
        warnings.append(
            "Several bullets repeatedly start with: "
            + ", ".join(sorted(repeated_starts))
            + ". Consider varying wording when truthful."
        )

    # --------------------------------------------------------
    # ATS-SAFETY / FORMAT CHOICES
    # --------------------------------------------------------

    if project.design.template_id == "ats_classic":
        passed.append("ATS Classic uses a single-column text-first structure.")

    if project.design.photo_enabled:
        if valid_photo_path(project.design):
            deductions += 2
            warnings.append(
                "A photo is enabled. CVM keeps it outside the main text flow, but some employers and regions prefer photo-free CVs."
            )
        else:
            deductions += 3
            issues.append("Photo is enabled but the selected photo file is unavailable or unsupported.")

    suspicious = sorted(
        glyph
        for glyph in SUSPICIOUS_GLYPHS
        if glyph in full_text
    )

    if suspicious:
        deductions += min(4, len(suspicious))
        warnings.append(
            "Decorative symbols detected in CV text: "
            + " ".join(suspicious)
            + ". Plain text is usually safer for parsing."
        )
    else:
        passed.append("No risky decorative glyphs were detected in the CV text.")

    visible_sections = [
        key
        for key, value in project.design.section_visibility.items()
        if value
    ]

    unknown_sections = [
        key
        for key in visible_sections
        if key not in STANDARD_SECTIONS
    ]

    if unknown_sections:
        deductions += 2
        warnings.append("Non-standard section identifiers were detected.")
    else:
        passed.append("Section structure uses conventional CV categories.")

    # --------------------------------------------------------
    # EXPORTED PDF PARSING AUDIT
    # --------------------------------------------------------

    if pdf_audit:
        if not pdf_audit.get("available", True):
            warnings.append(pdf_audit.get("message", "PDF parsing audit was unavailable."))
        elif not pdf_audit.get("compiled", True):
            deductions += 8
            issues.append(pdf_audit.get("message", "The CV could not be compiled for parsing verification."))
        else:
            if pdf_audit.get("selectable_text"):
                passed.append("Generated PDF contains selectable/extractable text.")
            else:
                deductions += 18
                issues.append("Generated PDF text could not be reliably extracted.")

            if pdf_audit.get("name_found"):
                passed.append("Candidate name is recoverable from the generated PDF text layer.")
            else:
                deductions += 10
                issues.append("Candidate name was not found in extracted PDF text.")

            expected = pdf_audit.get("expected_sections", [])
            found = pdf_audit.get("found_sections", [])

            if expected:
                coverage = len(found) / len(expected)

                if coverage >= 0.95:
                    passed.append("Visible CV section headings were recovered from the PDF text layer.")
                elif coverage >= 0.70:
                    deductions += 5
                    warnings.append("Some expected section headings were not recovered from the PDF text layer.")
                else:
                    deductions += 10
                    issues.append("Several expected section headings were missing from extracted PDF text.")

            if pdf_audit.get("section_order_valid"):
                passed.append("Extracted PDF section order is consistent with the intended reading order.")
            else:
                deductions += 8
                issues.append("Extracted PDF section order may not match the intended reading order.")

            page_count = int(pdf_audit.get("page_count", 0) or 0)
            desired_pages = 1 if project.design.page_mode == "1" else 2

            if page_count and page_count <= desired_pages:
                passed.append(f"Generated PDF fits the selected {desired_pages}-page target.")
            elif page_count:
                deductions += 4
                warnings.append(
                    f"Generated PDF currently uses {page_count} page(s), above the selected {desired_pages}-page target."
                )

            technical.append(
                f"PDF extraction: {pdf_audit.get('characters_extracted', 0)} characters, "
                f"{pdf_audit.get('block_count', 0)} text blocks, "
                f"{page_count} page(s)."
            )

    score = max(0, min(100, 100 - deductions))

    if score >= 90:
        label = "Strong"
    elif score >= 78:
        label = "Good"
    elif score >= 65:
        label = "Needs review"
    else:
        label = "Needs work"

    return {
        "score": score,
        "label": label,
        "issues": issues,
        "warnings": warnings,
        "passed": passed,
        "technical": technical,
        "checks_run": len(issues) + len(warnings) + len(passed),
        "note": (
            "CVM performs a local ATS-readiness audit of content, structure and the generated PDF text layer. "
            "It is not a score from Workday, Taleo, Greenhouse, SuccessFactors or any other employer ATS."
        ),
    }
