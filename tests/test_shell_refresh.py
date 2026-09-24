from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_jam_family_shell_refresh_is_loaded_last() -> None:
    index = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")

    assert 'css/shell_refresh.css' in index
    assert index.index('css/latex_ide.css') < index.index('css/shell_refresh.css')

    assert 'js/shell_refresh.js' in index
    assert index.index('js/latex_ide.js') < index.index('js/shell_refresh.js')


def test_shell_has_no_offline_first_footer_visible() -> None:
    css = (ROOT / "ui" / "css" / "shell_refresh.css").read_text(encoding="utf-8")

    assert ".sidebar-footer" in css
    assert "display: none !important;" in css


def test_topbar_command_bar_is_contained() -> None:
    css = (ROOT / "ui" / "css" / "shell_refresh.css").read_text(encoding="utf-8")

    assert ".cvm-command-bar" in css
    assert "overflow: hidden !important;" in css
    assert "#cvmLanguageToggle" in css


def test_logs_page_is_compact() -> None:
    css = (ROOT / "ui" / "css" / "shell_refresh.css").read_text(encoding="utf-8")
    js = (ROOT / "ui" / "js" / "shell_refresh.js").read_text(encoding="utf-8")

    assert "#page-logs-manager > .settings-card" in css
    assert 'return "logs";' in js


def test_shell_refresh_javascript_avoids_mutation_observer() -> None:
    js = (ROOT / "ui" / "js" / "shell_refresh.js").read_text(encoding="utf-8")

    assert "MutationObserver" not in js


def test_refreshed_branding_assets_exist() -> None:
    branding = ROOT / "assets" / "branding"

    for name in (
        "cvm_app_square.png",
        "cvm_app.ico",
    ):
        path = branding / name
        assert path.exists(), path
        assert path.stat().st_size > 0, path
