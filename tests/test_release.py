from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.config import (
    APP_VERSION,
    BUNDLED_TECTONIC,
    TECTONIC_BUNDLE_URL,
    TECTONIC_CACHE_DIR,
    PROJECT_EXTENSION,
    PROJECT_FILE_EXTENSIONS,
)
from src.models import create_demo_project
from src.project_manager import ProjectManager


def test_native_project_extension_is_cvm() -> None:
    assert PROJECT_EXTENSION == ".cvm"
    assert ".cvm" in PROJECT_FILE_EXTENSIONS
    assert ".cvproject" in PROJECT_FILE_EXTENSIONS


def test_new_save_uses_cvm_and_contains_format_marker() -> None:
    manager = ProjectManager()
    project = create_demo_project()

    with tempfile.TemporaryDirectory(prefix="cvm_release_") as temp_dir:
        target = Path(temp_dir) / "demo.cvproject"
        saved = manager.save(project, target)

        assert saved.suffix.lower() == ".cvm"
        assert saved.exists()

        data = json.loads(saved.read_text(encoding="utf-8"))
        assert data["_cvm"]["format"] == "CVM_PROJECT"
        assert data["_cvm"]["schema_version"] == 1

        loaded = manager.load(saved)
        assert loaded.personal.full_name == "Alex Morgan"


def test_legacy_cvproject_still_loads() -> None:
    manager = ProjectManager()
    project = create_demo_project()

    with tempfile.TemporaryDirectory(prefix="cvm_legacy_") as temp_dir:
        legacy = Path(temp_dir) / "legacy.cvproject"
        legacy.write_text(
            json.dumps(project.to_dict(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        loaded = manager.load(legacy)
        assert loaded.personal.full_name == "Alex Morgan"


def test_release_packaging_files_exist() -> None:
    required = [
        ROOT / "build" / "prepare_tectonic.ps1",
        ROOT / "build" / "release_windows.ps1",
        ROOT / "build" / "generate_version_info.py",
        ROOT / "build" / "README-FIRST.txt",
        ROOT / "assets" / "setup" / "cvm_setup_wizard.bmp",
        ROOT / "assets" / "setup" / "cvm_setup_small.bmp",
        ROOT / "THIRD_PARTY_NOTICES.txt",
    ]

    for path in required:
        assert path.exists(), path


def test_spec_is_onedir_and_bundles_runtime() -> None:
    spec = (ROOT / "build" / "CV_Maker.spec").read_text(encoding="utf-8")
    assert "COLLECT(" in spec
    assert "exclude_binaries=True" in spec
    assert '"runtime/tectonic"' in spec


def test_inno_setup_has_file_association_and_optional_shortcuts() -> None:
    iss = (ROOT / "build" / "CV_Maker.iss").read_text(encoding="utf-8")
    assert "DisableWelcomePage=no" in iss
    assert "CV Maker Project" in iss
    assert "Software\\Classes\\.cvm" in iss
    assert "fileassoc" in iss
    assert "desktopicon" in iss
    assert "startmenuicon" in iss
    assert "recursesubdirs" in iss


def test_offline_tectonic_paths_are_configured() -> None:
    assert BUNDLED_TECTONIC.name == "tectonic.exe"
    assert TECTONIC_CACHE_DIR.name == "cache"
    assert TECTONIC_BUNDLE_URL == "http://127.0.0.1:8765/default_bundle_v33.tar"


def test_release_script_generates_github_ready_assets() -> None:
    script = (ROOT / "build" / "release_windows.ps1").read_text(encoding="utf-8")
    assert "CV-Maker-Setup-$Version.exe" in script
    assert "CV-Maker-v$Version-Windows-x64.zip" in script
    assert "SHA256.txt" in script
    assert "ISCC" in script
    assert "Setup EXE, ZIP and SHA256.txt" in script


def test_current_version_is_1_0_1() -> None:
    # 1.0.1 is the first maintenance update after the validated 1.0.0 public release.
    assert APP_VERSION == "1.0.1"
