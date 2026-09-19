from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_performance_layer_is_wired():
    index = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "ui" / "css" / "performance.css").read_text(encoding="utf-8")
    js = (ROOT / "ui" / "js" / "performance_v072.js").read_text(encoding="utf-8")

    assert 'css/performance.css' in index
    assert 'js/performance_v072.js' in index
    assert 'id="activityPanel"' not in index
    assert 'id="journalToggle"' not in index
    assert "backdrop-filter: none" in css
    assert "cvmV072InstallProjectChanged" in js
    assert "cvmV072InstallLocalizationObserver" in js
    assert "cvmV072InstallToolFocusFix" in js


def test_exact_structured_pdf_preview_backend_removed():
    bridge = (ROOT / "src" / "bridge.py").read_text(encoding="utf-8")
    exporter = (ROOT / "src" / "pdf_exporter.py").read_text(encoding="utf-8")

    assert "render_pdf_preview" not in bridge
    assert "def preview_pages" not in exporter
    assert "base64" not in exporter


def test_error_focused_logger():
    logger = (ROOT / "src" / "app_logger.py").read_text(encoding="utf-8")

    assert "MAX_SESSION_EVENTS = 200" in logger
    assert "persist=False" in logger
    assert "persist=True" in logger
