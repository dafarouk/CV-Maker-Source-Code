from __future__ import annotations

import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.config import APP_VERSION
from src.latex_workspace import LatexWorkspace


def test_version() -> None:
    assert APP_VERSION == "1.0.2"


def test_home_and_assets() -> None:
    index = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "ui" / "css" / "v07.css").read_text(encoding="utf-8")
    brand_css = (ROOT / "ui" / "css" / "brand_damergi.css").read_text(encoding="utf-8")
    js = (ROOT / "ui" / "js" / "v07_features.js").read_text(encoding="utf-8")
    assert 'id="cvmLatexHomeBtn"' in index
    assert 'id="newCvBtn"' in index
    assert 'id="demoBtn"' in index
    assert 'css/v07.css' in index
    assert 'css/brand_damergi.css' in index
    assert 'js/v07_features.js' in index
    assert 'js/v101_core.js' in index
    assert 'js/latex_ide.js' in index
    assert 'css/latex_ide.css' in index
    assert 'data-theme="dark"' in index
    assert 'id="connectionBadge"' not in index
    assert 'id="themeToggle"' not in index
    assert 'data-page="settings"' not in index
    assert "../assets/branding/cvm.png" in index
    assert ".cvm-v07-home-hero" in css
    assert "#F8F6F1" in brand_css
    assert "#FFFDF9" in brand_css
    assert "#BC965D" in brand_css
    assert "#D0AA70" in brand_css
    assert "cvm_dark.png" in brand_css
    assert "cvm.png" in brand_css
    assert ".cvm-latex-overlay" in css
    assert "cvmV07InstallManualPdfPreview" in js
    assert "cvmV05ScheduleRealPreview = function" in js
    assert "compile_latex_preview" in js


def test_latex_starter_and_save() -> None:
    workspace = LatexWorkspace()
    source = workspace.starter_source()

    assert "\\documentclass" in source
    assert "\\begin{document}" in source
    assert "\\end{document}" in source
    with tempfile.TemporaryDirectory(prefix="cvm_v07_") as temp_dir:
        target = Path(temp_dir) / "custom_cv.tex"
        result = workspace.save_source(source, target)
        assert result["ok"]
        assert target.exists()
        assert target.read_text(encoding="utf-8") == source


def main() -> None:
    checks = (
        test_version,
        test_home_and_assets,
        test_latex_starter_and_save,
    )

    for check in checks:
        check()
        print(f"PASS {check.__name__}")
    print()
    print(f"CVM {APP_VERSION} TESTS OK")


if __name__ == "__main__":
    main()
