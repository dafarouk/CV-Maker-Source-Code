from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_home_language_patch_is_loaded() -> None:
    index = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")
    assert 'js/home_i18n.js' in index
    assert index.index('js/home_i18n.js') > index.index('js/v101_core.js')
    assert index.index('js/home_i18n.js') < index.index('js/latex_ide.js')


def test_home_buttons_have_bilingual_labels() -> None:
    js = (ROOT / "ui" / "js" / "home_i18n.js").read_text(encoding="utf-8")

    for value in [
        "Create CV",
        "Créer un CV",
        "Customize with LaTeX",
        "Personnaliser avec LaTeX",
        "Open Project",
        "Ouvrir un projet",
        "Try Demo CV",
        "Essayer le CV démo",
    ]:
        assert value in js

    assert "[data-cvm-language]" in js
    assert "document.documentElement.lang" in js
