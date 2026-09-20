from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.config import (
    GITHUB_REPOSITORY,
    UPDATE_CHECK_INTERVAL_HOURS,
    UPDATE_DOWNLOAD_DIR,
    UPDATE_HASH_ASSET_NAME,
    UPDATE_SUCCESS_FILE,
)
from src.updater import UpdateService


def test_github_repository_is_configured() -> None:
    assert GITHUB_REPOSITORY == "dafarouk/CV-Maker"
    assert UPDATE_CHECK_INTERVAL_HOURS == 24
    assert UPDATE_HASH_ASSET_NAME == "SHA256.txt"
    assert UPDATE_DOWNLOAD_DIR.name == "updates"
    assert UPDATE_SUCCESS_FILE.name == "update_success.json"


def test_version_parser_handles_release_tags() -> None:
    assert str(UpdateService._version("v1.0.0")) == "1.0.0"
    assert str(UpdateService._version("1.2.3")) == "1.2.3"
    assert UpdateService._version("not-a-version") is None


def test_setup_asset_prefers_exact_version_filename() -> None:
    assets = [
        {
            "name": "CV-Maker-v1.2.3-Windows-x64.zip",
            "browser_download_url": "https://example.test/a.zip",
        },
        {
            "name": "CV-Maker-Setup-1.2.3.exe",
            "browser_download_url": "https://example.test/setup.exe",
        },
    ]
    asset = UpdateService._setup_asset(assets, "1.2.3")
    assert asset is not None
    assert asset["name"] == "CV-Maker-Setup-1.2.3.exe"


def test_updater_ui_is_loaded_after_existing_ui_layers() -> None:
    index = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")
    assert 'js/recovery_ui.js' in index
    assert 'js/updater_ui.js' in index
    assert index.index('js/updater_ui.js') > index.index('js/recovery_ui.js')


def test_bridge_exposes_update_actions() -> None:
    bridge = (ROOT / "src" / "bridge.py").read_text(encoding="utf-8")
    assert "AppBridge.check_for_updates = _v05_check_for_updates" in bridge
    assert "AppBridge.download_update = _v05_download_update" in bridge
    assert "AppBridge.install_update = _v05_install_update" in bridge


def test_inno_setup_supports_silent_update_restart() -> None:
    iss = (ROOT / "build" / "CV_Maker.iss").read_text(encoding="utf-8")
    assert "Check: WizardSilent" in iss
    assert "AppUpdatesURL=https://github.com/dafarouk/CV-Maker/releases" in iss


def test_release_script_requires_hash_upload() -> None:
    script = (ROOT / "build" / "release_windows.ps1").read_text(encoding="utf-8")
    assert "SHA256.txt" in script
    assert "Setup EXE, ZIP and SHA256.txt" in script


def test_updater_reports_download_progress_and_uses_visible_installer() -> None:
    updater = (ROOT / "src" / "updater.py").read_text(encoding="utf-8")
    bridge = (ROOT / "src" / "bridge.py").read_text(encoding="utf-8")

    assert "progress_callback" in updater
    assert 'response.headers.get("Content-Length")' in updater
    assert '"downloaded_bytes"' in updater
    assert '"total_bytes"' in updater
    assert '"/SILENT"' in updater
    assert '"/VERYSILENT"' not in updater
    assert '"cvmUpdaterReceiveProgress"' in bridge


def test_updater_centered_progress_ui_and_preview_labels_are_visible() -> None:
    updater_ui = (ROOT / "ui" / "js" / "updater_ui.js").read_text(encoding="utf-8")
    css = (ROOT / "ui" / "css" / "product_polish.css").read_text(encoding="utf-8")

    assert "cvmUpdaterReceiveProgress" in updater_ui
    assert "cvm-updater-progress-layer" in updater_ui
    assert "Do not close or reopen CV Maker manually" in updater_ui
    assert '#cvPreview strong' in css
    assert '#cvPreview .preview-tools' in css
    assert '.cvm-updater-progress-layer' in css


def test_post_update_success_marker_and_changelog_are_present() -> None:
    updater = (ROOT / "src" / "updater.py").read_text(encoding="utf-8")
    updater_ui = (ROOT / "ui" / "js" / "updater_ui.js").read_text(encoding="utf-8")
    css = (ROOT / "ui" / "css" / "product_polish.css").read_text(encoding="utf-8")

    assert "_capture_legacy_completed_update" in updater
    assert "_write_pending_update" in updater
    assert "consume_completed_update" in updater
    assert '"completed_update"' in updater
    assert "cvmUpdaterShowCompletedUpdate" in updater_ui
    assert "CV Maker updated successfully" in updater_ui
    assert "Problems fixed & improvements" in updater_ui
    assert "cvmUpdaterV102Highlights" in updater_ui
    assert ".cvm-update-success-hero" in css
    assert ".cvm-update-fix-item" in css
