from __future__ import annotations

import re
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
from src.project_manager import ProjectManager


def main() -> None:
    project = create_demo_project()

    project.design.section_order = [
        "skills",
        "profile",
        "experiences",
        "projects",
        "education",
        "volunteering",
        "languages",
        "certifications",
    ]

    restored = CVProject.from_dict(
        project.to_dict()
    )

    assert restored.design.section_order[0] == "skills"

    latex = CVEngine().render_latex(
        restored
    )

    assert "Alex Morgan" in latex
    assert "PROFESSIONAL EXPERIENCE" in latex
    assert latex.index("TECHNICAL SKILLS") < latex.index("PROFILE")

    ats = run_ats_check(
        restored
    )

    assert 0 <= ats["score"] <= 100


    with tempfile.TemporaryDirectory(
        prefix="cvm_smoke_"
    ) as temp_dir:
        temp_path = Path(
            temp_dir
        )

        manager = ProjectManager()

        saved = manager.save(
            restored,
            temp_path / "demo.cvm",
        )

        loaded = manager.load(
            saved
        )

        assert loaded.personal.full_name == "Alex Morgan"
        assert loaded.design.section_order[0] == "skills"

        docx_result = DOCXExporter().export(
            loaded,
            temp_path,
        )

        assert docx_result["ok"]
        assert Path(
            docx_result["docx_path"]
        ).exists()

    html = (
        ROOT
        / "ui"
        / "index.html"
    ).read_text(
        encoding="utf-8"
    )

    js = (
        ROOT
        / "ui"
        / "js"
        / "app.js"
    ).read_text(
        encoding="utf-8"
    )

    v03_js = (
        ROOT
        / "ui"
        / "js"
        / "v03_features.js"
    ).read_text(
        encoding="utf-8"
    )

    html_ids = set(
        re.findall(
            r'id="([^"]+)"',
            html,
        )
    )

    required_ids = {
        "appShell",
        "editorRoot",
        "cvPreview",
        "atsResults",
        "exportPdfBtn",
        "exportDocxBtn",
        "quickPdfBtn",
        "quickDocxBtn",
        "sectionOrderList",
        "exportOpenFolderBtn",
    }

    assert required_ids.issubset(
        html_ids
    )

    assert "connectionBadge" not in html_ids
    assert "themeToggle" not in html_ids
    assert "settingsThemeBtn" not in html_ids
    assert 'data-page="settings"' not in html
    assert 'data-theme="dark"' in html
    assert 'js/v101_core.js' in html

    assert "pywebviewready" in js
    assert "startBridgeRetry" in js
    assert "cvmRenderSectionOrderList" in v03_js
    assert "cvmDecorateDynamicCards" in v03_js
    assert "cvmOpenExportModal" in v03_js

    pdf_capability = PDFExporter().capability()

    print(f"CVM {APP_VERSION} SMOKE TEST OK")
    print(f"ATS score: {ats['score']}/100")
    print(
        "PDF engine: "
        + (
            pdf_capability.get("engine")
            or "not detected"
        )
    )


if __name__ == "__main__":
    main()
