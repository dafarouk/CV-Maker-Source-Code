from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.ats_checker import run_ats_check
from src.config import APP_VERSION
from src.cv_engine import CVEngine
from src.docx_exporter import DOCXExporter
from src.models import CVProject, create_demo_project
from src.pdf_exporter import PDFExporter
from src.v05_features import (
    V05Services,
    bullet_quality_report,
    completeness_report,
    optimizer_report,
)


def assert_project_roundtrip() -> None:
    project = create_demo_project()
    project.design.ui_language = "fr"
    project.design.cv_language = "en"
    project.design.country_preset = "uk"
    project.design.section_titles["experiences"] = "WORK EXPERIENCE"

    restored = CVProject.from_dict(project.to_dict())

    assert restored.design.ui_language == "fr"
    assert restored.design.cv_language == "en"
    assert restored.design.country_preset == "uk"
    assert restored.design.section_titles["experiences"] == "WORK EXPERIENCE"


def assert_old_project_compatibility() -> None:
    project = create_demo_project().to_dict()
    design = project["design"]

    for key in (
        "ui_language",
        "cv_language",
        "country_preset",
        "section_titles",
    ):
        design.pop(key, None)

    design["language"] = "fr"

    restored = CVProject.from_dict(project)

    assert restored.design.ui_language == "fr"
    assert restored.design.cv_language == "fr"
    assert isinstance(restored.design.section_titles, dict)


def assert_templates() -> None:
    service = V05Services()
    catalog = service.template_catalog()

    required_ids = {
        "ats_classic",
        "ats_modern",
        "ats_compact",
        "executive",
    }

    assert required_ids.issubset(
        {item["id"] for item in catalog}
    )

    project = create_demo_project()
    engine = CVEngine()

    for template_id in required_ids:
        project.design.template_id = template_id
        source = engine.render_latex(project)
        assert "Alex Morgan" in source
        assert "\\begin{document}" in source


def assert_language_independence() -> None:
    project = create_demo_project()
    project.design.ui_language = "fr"
    project.design.cv_language = "en"
    project.design.language = "en"

    source = CVEngine().render_latex(project)

    assert "PROFESSIONAL EXPERIENCE" in source
    assert "EXPÉRIENCE PROFESSIONNELLE" not in source

    project.design.cv_language = "fr"
    project.design.language = "fr"

    source = CVEngine().render_latex(project)

    assert "EXPÉRIENCE PROFESSIONNELLE" in source


def assert_custom_section_names() -> None:
    project = create_demo_project()
    project.design.section_titles["experiences"] = "CAREER HISTORY"

    source = CVEngine().render_latex(project)

    assert "CAREER HISTORY" in source


def assert_analysis_features() -> None:
    project = create_demo_project()

    completeness = completeness_report(project)
    optimizer = optimizer_report(project)
    bullets = bullet_quality_report(project)
    ats = run_ats_check(project)

    assert 0 <= completeness["score"] <= 100
    assert isinstance(completeness["missing"], list)

    assert optimizer["target_pages"] in {1, 2}
    assert isinstance(optimizer["suggestions"], list)

    assert isinstance(bullets["bullets"], list)
    assert "issue_count" in bullets

    assert 0 <= ats["score"] <= 100


def assert_country_presets() -> None:
    presets = V05Services().country_presets()

    for key in (
        "international",
        "france",
        "uk",
        "usa",
        "germany",
    ):
        assert key in presets

    assert presets["france"]["default_cv_language"] == "fr"
    assert presets["uk"]["photo_recommendation"] == "avoid"
    assert presets["usa"]["photo_recommendation"] == "avoid"


def assert_docx_export() -> None:
    project = create_demo_project()

    with tempfile.TemporaryDirectory(
        prefix="cvm_v05_docx_"
    ) as temp_dir:
        target = Path(temp_dir) / "demo.docx"

        result = DOCXExporter().export(
            project,
            target,
        )

        assert result["ok"]
        assert target.exists()
        assert target.stat().st_size > 0


def assert_pdf_export_when_engine_exists() -> None:
    project = create_demo_project()
    exporter = PDFExporter()

    capability = exporter.capability()

    if not capability["available"]:
        print(
            "PDF engine not available: "
            "PDF export/preview runtime tests skipped."
        )
        return

    with tempfile.TemporaryDirectory(
        prefix="cvm_v05_pdf_"
    ) as temp_dir:
        target = Path(temp_dir) / "demo.pdf"

        result = exporter.export(
            project,
            target,
        )

        assert result["ok"]
        assert target.exists()
        assert result["validation"]["selectable_text"]



def assert_import_docx() -> None:
    project = create_demo_project()
    service = V05Services()

    with tempfile.TemporaryDirectory(
        prefix="cvm_v05_import_"
    ) as temp_dir:
        source = Path(temp_dir) / "source.docx"

        exported = DOCXExporter().export(
            project,
            source,
        )

        assert exported["ok"]

        imported = service.import_cv(
            str(source)
        )

        assert imported["ok"]
        restored = CVProject.from_dict(
            imported["project"]
        )

        assert restored.personal.full_name
        assert (
            restored.personal.email
            or restored.profile
            or restored.experiences
        )


def assert_ui_static_contract() -> None:
    index = (
        ROOT
        / "ui"
        / "index.html"
    ).read_text(
        encoding="utf-8"
    )

    v05_css = (
        ROOT
        / "ui"
        / "css"
        / "v05.css"
    ).read_text(
        encoding="utf-8"
    )

    assert 'css/v05.css' in index
    assert 'js/productivity_v05.js' in index

    required_css = (
        ".cvm-completeness",
        ".cvm-tool-chip",
        ".cvm-bullet-editor",
        ".cvm-template-gallery",
        ":focus-visible",
    )

    for marker in required_css:
        assert marker in v05_css


def assert_about_and_release_config() -> None:
    about = V05Services().about()

    assert about["version"] == APP_VERSION
    assert about["website"] == "https://www.damergi.com"
    assert isinstance(
        about["licenses"],
        list,
    )

    update = V05Services().update_check()

    # Before the public GitHub repo exists, this is expected.
    if not update.get("configured"):
        assert update["ok"] is False


def main() -> None:
    checks = [
        assert_project_roundtrip,
        assert_old_project_compatibility,
        assert_templates,
        assert_language_independence,
        assert_custom_section_names,
        assert_analysis_features,
        assert_country_presets,
        assert_docx_export,
        assert_pdf_export_when_engine_exists,
        assert_import_docx,
        assert_ui_static_contract,
        assert_about_and_release_config,
    ]

    for check in checks:
        check()
        print(
            f"PASS {check.__name__}"
        )

    print()
    print(
        f"CVM {APP_VERSION} FULL TEST SUITE OK"
    )


if __name__ == "__main__":
    main()
