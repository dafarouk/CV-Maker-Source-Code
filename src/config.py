from pathlib import Path
import sys

from platformdirs import user_data_dir


# ============================================================
# APPLICATION
# ============================================================

APP_NAME = "CVM"
APP_FULL_NAME = "CV Maker"
APP_VERSION = "1.0.2"
APP_AUTHOR = "Farouk"

WINDOW_TITLE = f"{APP_FULL_NAME} - By {APP_AUTHOR}"


# ============================================================
# PROJECT FORMAT
# ============================================================
# Current native CV Maker project format.
PROJECT_EXTENSION = ".cvm"

# Older CVM builds used .cvproject. Keep it readable so existing
# user projects are never broken during the migration to .cvm.
LEGACY_PROJECT_EXTENSIONS = (
    ".cvproject",
)

PROJECT_FILE_EXTENSIONS = (
    PROJECT_EXTENSION,
    *LEGACY_PROJECT_EXTENSIONS,
)

PROJECT_FORMAT_ID = "CVM_PROJECT"
PROJECT_SCHEMA_VERSION = 1

DEFAULT_TEMPLATE_ID = "ats_classic"
# ============================================================
# PROJECT / PACKAGED RESOURCES
# ============================================================

if (
    getattr(
        sys,
        "frozen",
        False,
    )
    and hasattr(
        sys,
        "_MEIPASS",
    )
):
    RESOURCE_ROOT = Path(sys._MEIPASS)
else:
    RESOURCE_ROOT = (
        Path(__file__)
        .resolve()
        .parent
        .parent
    )
SRC_DIR = RESOURCE_ROOT / "src"
UI_DIR = RESOURCE_ROOT / "ui"
ASSETS_DIR = RESOURCE_ROOT / "assets"
BRANDING_DIR = ASSETS_DIR / "branding"
ICONS_DIR = ASSETS_DIR / "icons"
TEMPLATES_DIR = RESOURCE_ROOT / "templates"
LATEX_TEMPLATES_DIR = TEMPLATES_DIR / "latex"
DOCX_TEMPLATES_DIR = TEMPLATES_DIR / "docx"
# ============================================================
# BRANDING
# ============================================================

LOGO_PATH = BRANDING_DIR / "cvm_dark.png"
LIGHT_LOGO_PATH = BRANDING_DIR / "cvm.png"
DARK_LOGO_PATH = BRANDING_DIR / "cvm_dark.png"
SPLASH_LOGO_PATH = BRANDING_DIR / "cvm_bg.png"
APP_ICON_PATH = BRANDING_DIR / "cvm_app.ico"
UI_INDEX_PATH = UI_DIR / "index.html"
# ============================================================
# USER DATA
# ============================================================

if getattr(
    sys,
    "frozen",
    False,
):
    DATA_ROOT = Path(
        user_data_dir(
            APP_FULL_NAME,
            APP_AUTHOR,
        )
    )
else:
    DATA_ROOT = RESOURCE_ROOT / "data"

PROJECTS_DIR = DATA_ROOT / "projects"
AUTOSAVE_DIR = DATA_ROOT / "autosave"
SETTINGS_DIR = DATA_ROOT / "settings"
if getattr(
    sys,
    "frozen",
    False,
):
    LOGS_DIR = (
        Path(
            user_data_dir(
                APP_FULL_NAME,
                APP_AUTHOR,
            )
        )
        / "logs"
    )

    EXPORTS_DIR = (
        Path.home()
        / "Documents"
        / "CVM Exports"
    )
else:
    LOGS_DIR = RESOURCE_ROOT / "logs"
    EXPORTS_DIR = RESOURCE_ROOT / "exports"
# ============================================================
# WINDOW
# ============================================================

WINDOW_MIN_WIDTH = 1100
WINDOW_MIN_HEIGHT = 700
WINDOW_DEFAULT_WIDTH = 1440
WINDOW_DEFAULT_HEIGHT = 900


# ============================================================
# PRODUCT / RELEASE SETTINGS
# ============================================================
# Public GitHub repository used by the built-in updater.
# Public repository used by CV Maker 1.0.0 and later.
GITHUB_REPOSITORY = "dafarouk/CV-Maker"
# Automatic update checks are rate-limited so CVM does not contact GitHub
# on every startup. Manual checks always bypass this interval.
UPDATE_CHECK_INTERVAL_HOURS = 24
UPDATE_HASH_ASSET_NAME = "SHA256.txt"

DONATION_URL = "https://paypal.me/BigBossManTN"
WEBSITE_URL = "https://www.damergi.com"
RECOVERY_FILE = AUTOSAVE_DIR / f"recovery{PROJECT_EXTENSION}"
RECENTS_FILE = SETTINGS_DIR / "recent_projects.json"
UPDATE_CACHE_FILE = SETTINGS_DIR / "update_check.json"
UPDATE_SUCCESS_FILE = SETTINGS_DIR / "update_success.json"
UPDATE_DOWNLOAD_DIR = SETTINGS_DIR / "updates"
EXPORT_HISTORY_FILE = SETTINGS_DIR / "export_history.json"
# ============================================================
# BUNDLED LATEX ENGINE
# ============================================================
# Public Windows builds bundle Tectonic plus a prepared resource cache.
# The cache was primed from this exact bundle URL and is used with
# --only-cached, so installed CVM does not need network access for PDF export.
TECTONIC_DIR = RESOURCE_ROOT / "runtime" / "tectonic"
BUNDLED_TECTONIC = TECTONIC_DIR / "tectonic.exe"
TECTONIC_CACHE_DIR = TECTONIC_DIR / "cache"
TECTONIC_BUNDLE_URL = "http://127.0.0.1:8765/default_bundle_v33.tar"
# ============================================================
# RUNTIME
# ============================================================

def ensure_runtime_directories() -> None:
    folders = (
        DATA_ROOT,
        PROJECTS_DIR,
        AUTOSAVE_DIR,
        SETTINGS_DIR,
        UPDATE_DOWNLOAD_DIR,
        LOGS_DIR,
        EXPORTS_DIR,
        LATEX_TEMPLATES_DIR,
        DOCX_TEMPLATES_DIR,
    )
    for folder in folders:
        folder.mkdir(
            parents=True,
            exist_ok=True,
        )
