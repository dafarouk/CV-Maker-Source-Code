from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_latex_ide_assets_are_loaded_after_existing_layers() -> None:
    index = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")

    assert 'css/latex_ide.css' in index
    assert 'js/latex_ide.js' in index
    assert index.index('css/latex_ide.css') > index.index('css/v101_hotfix_02.css')
    assert index.index('js/latex_ide.js') > index.index('js/v07_features.js')
    assert index.index('js/latex_ide.js') > index.index('js/v101_core.js')


def test_latex_ide_keeps_existing_textarea_as_source_of_truth() -> None:
    js = (ROOT / "ui" / "js" / "latex_ide.js").read_text(encoding="utf-8")

    # The original CVM textarea stays the source of truth.
    assert "#cvmLatexEditor" in js

    # IDE behavior added around the existing textarea.
    assert "function highlightLatex(" in js
    assert "function indent(" in js
    assert "function openFind(" in js
    assert "function replaceCurrent(" in js
    assert "function replaceAll(" in js
    assert "MutationObserver" in js

    # The enhancement remains fully local/offline.
    assert "https://" not in js
    assert "http://" not in js


def test_latex_ide_visual_layer_uses_cvm_palette() -> None:
    css = (ROOT / "ui" / "css" / "latex_ide.css").read_text(encoding="utf-8")

    assert ".cvm-ide-highlight" in css
    assert ".cvm-ide-current-line" in css
    assert ".cvm-ide-findbar" in css
    assert ".cvm-ide-status-right" in css
    assert "#BC965D" in css
    assert "#D0AA70" in css
    assert "#0D1420" in css


def test_existing_latex_backend_contract_is_untouched() -> None:
    v07 = (ROOT / "ui" / "js" / "v07_features.js").read_text(encoding="utf-8")

    assert "compile_latex_preview" in v07
    assert "save_latex_source" in v07
    assert "export_latex_pdf" in v07
    assert 'id="cvmLatexEditor"' in v07
