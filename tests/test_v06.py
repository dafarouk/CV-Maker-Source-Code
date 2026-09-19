from __future__ import annotations

import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.config import APP_VERSION
from src.cv_engine import CVEngine, format_date_range
from src.docx_exporter import DOCXExporter
from src.models import CVProject, create_demo_project


def test_human_date_ranges() -> None:
    assert format_date_range("06/2026", "09/2026", language="en") == "June - September 2026"
    assert format_date_range("06/2025", "09/2026", language="en") == "June 2025 - September 2026"
    assert format_date_range("06/2026", "09/2026", language="fr") == "Juin - Septembre 2026"


def test_project_year_migration() -> None:
    project = create_demo_project().to_dict()

    project["projects"] = [
        {
            "name": "Legacy project",
            "subtitle": "",
            "date": "06/2026",
            "bullets": [],
            "tools": [],
            "link": "",
        },
        {
            "name": "Temporary v0.6 range",
            "subtitle": "",
            "start_date": "06/2025",
            "end_date": "09/2026",
            "bullets": [],
            "tools": [],
            "link": "",
        },
    ]

    restored = CVProject.from_dict(project)

    assert restored.projects[0].year == "2026"
    assert restored.projects[1].year == "2026"


def test_project_output_is_year_only() -> None:
    project = create_demo_project()
    project.projects[0].year = "2026"
    project.projects[0].date = "06/2026"
    project.projects[0].start_date = "06/2025"
    project.projects[0].end_date = "09/2026"

    for template_id in (
        "ats_classic",
        "ats_modern",
        "ats_compact",
        "executive",
    ):
        project.design.template_id = template_id
        source = CVEngine().render_latex(project)

        assert "2026" in source
        assert "June 2025 - September 2026" not in source
        assert "June - September 2026" not in source


def test_docx_export() -> None:
    project = create_demo_project()
    project.projects[0].year = "2026"

    with tempfile.TemporaryDirectory(prefix="cvm_v061_") as temp_dir:
        target = Path(temp_dir) / "v061.docx"
        result = DOCXExporter().export(project, target)

        assert result["ok"]
        assert target.exists()
        assert target.stat().st_size > 0


def test_ui_contract() -> None:
    editor = (ROOT / "ui" / "js" / "editor_v06.js").read_text(encoding="utf-8")
    css = (ROOT / "ui" / "css" / "v06.css").read_text(encoding="utf-8")

    assert "cvm-language-flag" in editor
    assert "cvm-language-flag--uk" in editor
    assert "cvm-language-flag--fr" in editor
    assert "function cvmV06UpgradeProjectYears" in editor
    assert re.search(r'cvmV06Text\(\s*"Year"\s*,\s*"Année"\s*\)', editor)
    assert "function cvmV06RemoveCountryPreset" in editor
    assert "function cvmV06ShowAbout" in editor

    assert "#page-content > .page-heading" in css
    assert "display: none !important" in css
    assert ".cvm-language-choice strong" in css
    assert ".cvm-about-v062" in css
    assert ".cvm-editor-workspace" in css
    assert ".cvm-editor-shared-preview" in css


def main() -> None:
    checks = (
        test_human_date_ranges,
        test_project_year_migration,
        test_project_output_is_year_only,
        test_docx_export,
        test_ui_contract,
    )

    for check in checks:
        check()
        print(f"PASS {check.__name__}")

    print()
    print(f"CVM {APP_VERSION} V0.6 COMPATIBILITY TESTS OK")


if __name__ == "__main__":
    main()
