from __future__ import annotations

import base64
import json
import os
import platform
import threading
import time
from pathlib import Path

import webview

from src.app_logger import AppLogger
from src.ats_checker import run_ats_check
from src.config import (
    APP_AUTHOR,
    APP_FULL_NAME,
    APP_NAME,
    APP_VERSION,
    AUTOSAVE_DIR,
    EXPORTS_DIR,
    EXPORT_HISTORY_FILE,
    LOGO_PATH,
    LOGS_DIR,
    PROJECT_EXTENSION,
    PROJECT_FILE_EXTENSIONS,
    PROJECTS_DIR,
    SETTINGS_DIR,
    SPLASH_LOGO_PATH,
    ensure_runtime_directories,
)
from src.docx_exporter import DOCXExporter
from src.latex_workspace import LatexWorkspace
from src.models import CVProject, create_blank_project, create_demo_project
from src.pdf_exporter import PDFExporter
from src.project_manager import ProjectManager, safe_filename
from src.updater import UpdateService
from src.v05_features import V05Services, completeness_report, optimizer_report, bullet_quality_report


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}


class AppBridge:
    def __init__(self) -> None:
        ensure_runtime_directories()

        self._window = None
        self._project_manager = ProjectManager()
        self._pdf_exporter = PDFExporter()
        self._docx_exporter = DOCXExporter()
        self._latex_workspace = LatexWorkspace()
        self._v05 = V05Services()
        self._updater = UpdateService()
        self._dirty = False
        self._allow_close = False

        self._current_project = create_blank_project()
        self._current_project_path: Path | None = None
        self._project_active = False
        self._startup_project_loaded = False

        # The live activity journal was removed in 0.7.2.
        # Keep diagnostics local and error-focused instead of streaming every
        # log event through the pywebview bridge.
        self._logger = AppLogger()

        self._logger.info(
            f"{APP_FULL_NAME} {APP_VERSION} starting"
        )

    # =========================================================
    # WINDOW / JS
    # =========================================================

    def set_window(self, window) -> None:
        self._window = window

    def _call_js(
        self,
        function_name: str,
        payload=None,
    ) -> None:
        if not self._window:
            return

        try:
            if payload is None:
                script = (
                    f"window.{function_name} && "
                    f"window.{function_name}();"
                )
            else:
                serialized = json.dumps(
                    payload,
                    ensure_ascii=False,
                )

                script = (
                    f"window.{function_name} && "
                    f"window.{function_name}({serialized});"
                )

            self._window.evaluate_js(script)

        except Exception:
            pass

    def _on_log_event(
        self,
        event: dict,
    ) -> None:
        self._call_js(
            "cvmReceiveLog",
            event,
        )

    # =========================================================
    # INITIAL STATE
    # =========================================================

    def get_initial_state(self) -> dict:
        return {
            "app": {
                "name": APP_NAME,
                "full_name": APP_FULL_NAME,
                "version": APP_VERSION,
                "author": APP_AUTHOR,
            },
            "system": {
                "platform": platform.system(),
                "platform_version": platform.version(),
                "python": platform.python_version(),
            },
            "paths": {
                "projects": str(PROJECTS_DIR),
                "autosave": str(AUTOSAVE_DIR),
                "settings": str(SETTINGS_DIR),
                "logs": str(LOGS_DIR),
                "exports": str(EXPORTS_DIR),
                "logo": str(LOGO_PATH),
                "splash_logo": str(SPLASH_LOGO_PATH),
            },
            "project": self._current_project.to_dict(),
            "project_active": self._project_active,
            "pdf": self._pdf_exporter.capability(),
            "latex_workspace": self._latex_workspace.capability(),
            "logs": [],
            "recovery": self._v05.recovery_state(),
            "recent_projects": self._v05.recent_projects(),
            "about": self._v05.about(),
        }

    def ui_ready(self) -> dict:
        self._logger.success(
            "Interface loaded successfully"
        )

        if self._startup_project_loaded and self._window:
            try:
                self._window.evaluate_js(
                    """
                    setTimeout(() => {
                        window.cvmV06SetProjectActive?.(true);
                        window.cvmV06OpenEditor?.({
                            askLanguage: false,
                            tab: 'content'
                        });
                    }, 450);
                    """
                )
            except Exception:
                pass

        return {
            "ok": True,
            "version": APP_VERSION,
        }

    def mark_startup_project_loaded(
        self,
        loaded: bool,
    ) -> None:
        self._startup_project_loaded = bool(loaded)

    # =========================================================
    # PROJECT
    # =========================================================

    def create_new_project(self) -> dict:
        self._current_project = create_blank_project()
        self._current_project_path = None
        self._project_active = True

        self._logger.success(
            "New CV project created"
        )

        return {
            "ok": True,
            "project": self._current_project.to_dict(),
        }

    def load_demo_project(self) -> dict:
        self._current_project = create_demo_project()
        self._current_project_path = None
        self._project_active = True

        self._logger.success(
            "Demo CV loaded"
        )

        return {
            "ok": True,
            "project": self._current_project.to_dict(),
        }

    def update_project(
        self,
        project_data: dict,
    ) -> dict:
        try:
            self._current_project = CVProject.from_dict(
                project_data
            )
            self._project_active = True

            self._project_manager.autosave(
                self._current_project
            )
            self._dirty = False

            return {"ok": True}

        except Exception as exc:
            self._logger.error(
                "Autosave failed.",
                step="Autosave CV project",
                exc=exc,
            )

            return {
                "ok": False,
                "message": "CVM could not autosave this project.",
            }

    def save_project(
        self,
        project_data: dict,
    ) -> dict:
        try:
            self._current_project = CVProject.from_dict(
                project_data
            )
            self._project_active = True

            path = self._project_manager.save(
                self._current_project,
                self._current_project_path,
            )

            self._current_project_path = path
            self._dirty = False
            self._v05.remember_project(path)

            self._logger.success(
                f"Project saved: {path.name}"
            )

            return {
                "ok": True,
                "path": str(path),
            }

        except Exception as exc:
            self._logger.error(
                "The CV project could not be saved.",
                step="Save project",
                exc=exc,
            )

            return {
                "ok": False,
                "message": "The CV project could not be saved.",
            }

    def open_project(self) -> dict:
        if not self._window:
            return {
                "ok": False,
                "message": "Application window is not ready.",
            }

        try:
            selection = self._window.create_file_dialog(
                webview.FileDialog.OPEN,
                allow_multiple=False,
                directory=str(PROJECTS_DIR),
                file_types=(
                    "CV Maker Project (*.cvm;*.cvproject)",
                ),
            )

            if not selection:
                return {
                    "ok": False,
                    "cancelled": True,
                }

            path = (
                selection[0]
                if isinstance(selection, (list, tuple))
                else selection
            )

            project_path = Path(path)

            if project_path.suffix.lower() not in PROJECT_FILE_EXTENSIONS:
                return {
                    "ok": False,
                    "message": "Please select a .cvm project file.",
                }

            project = self._project_manager.load(project_path)

            self._current_project = project
            self._current_project_path = project_path
            self._project_active = True
            self._dirty = False
            self._v05.remember_project(project_path)

            self._logger.success(
                f"Project opened: {project_path.name}"
            )

            return {
                "ok": True,
                "project": project.to_dict(),
                "path": str(project_path),
            }

        except Exception as exc:
            self._logger.error(
                "The selected project could not be opened.",
                step="Open CV project",
                exc=exc,
            )

            return {
                "ok": False,
                "message": "The selected project could not be opened.",
            }

    def load_project_path(self, path: str) -> dict:
        try:
            project_path = Path(path)

            if (
                not project_path.exists()
                or not project_path.is_file()
                or project_path.suffix.lower() not in PROJECT_FILE_EXTENSIONS
            ):
                return {
                    "ok": False,
                    "message": "Please select a valid .cvm project file.",
                }

            project = self._project_manager.load(project_path)
            self._current_project = project
            self._current_project_path = project_path
            self._project_active = True
            self._dirty = False
            self._v05.remember_project(project_path)

            self._logger.success(
                f"Project opened: {project_path.name}"
            )

            return {
                "ok": True,
                "project": project.to_dict(),
                "path": str(project_path),
            }

        except Exception as exc:
            self._logger.error(
                "The selected project could not be opened.",
                step="Open CV project",
                exc=exc,
            )
            return {
                "ok": False,
                "message": "The selected project could not be opened.",
            }

    # =========================================================
    # CUSTOM CVM FILE BROWSER
    # =========================================================

    def browse_path(
        self,
        path: str = "",
        mode: str = "folder",
    ) -> dict:
        try:
            if path:
                current = Path(path).expanduser()
            elif mode == "photo":
                pictures = Path.home() / "Pictures"
                current = pictures if pictures.exists() else Path.home()
            elif mode == "project":
                current = PROJECTS_DIR
            else:
                current = EXPORTS_DIR

            if current.is_file():
                current = current.parent

            if not current.exists() or not current.is_dir():
                current = EXPORTS_DIR

            current = current.resolve()
            directories = []
            files = []

            try:
                entries = sorted(
                    current.iterdir(),
                    key=lambda item: (
                        not item.is_dir(),
                        item.name.lower(),
                    ),
                )
            except PermissionError:
                entries = []

            for item in entries:
                try:
                    if item.is_dir():
                        directories.append(
                            {
                                "name": item.name,
                                "path": str(item),
                            }
                        )
                        continue

                    allowed_file = (
                        mode == "photo" and item.suffix.lower() in IMAGE_EXTENSIONS
                    ) or (
                        mode == "project" and item.suffix.lower() in PROJECT_FILE_EXTENSIONS
                    ) or (
                        mode == "import" and item.suffix.lower() in {".pdf", ".docx"}
                    )

                    if allowed_file:
                        files.append(
                            {
                                "name": item.name,
                                "path": str(item),
                                "extension": item.suffix.lower(),
                            }
                        )
                except OSError:
                    continue

            drives = []

            if os.name == "nt":
                for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
                    drive = Path(f"{letter}:\\")

                    if drive.exists():
                        drives.append(str(drive))
            else:
                drives.append("/")

            parent = current.parent

            return {
                "ok": True,
                "current": str(current),
                "parent": (
                    str(parent)
                    if parent != current
                    else ""
                ),
                "directories": directories,
                "files": files,
                "drives": drives,
                "shortcuts": [
                    {
                        "name": "CVM Exports",
                        "path": str(EXPORTS_DIR),
                    },
                    {
                        "name": "Documents",
                        "path": str(Path.home() / "Documents"),
                    },
                    {
                        "name": "Desktop",
                        "path": str(Path.home() / "Desktop"),
                    },
                ],
            }

        except Exception as exc:
            return {
                "ok": False,
                "message": str(exc),
            }

    def get_export_defaults(
        self,
        project_data: dict,
        export_format: str,
    ) -> dict:
        project = CVProject.from_dict(project_data)
        extension = ".pdf" if export_format.lower() == "pdf" else ".docx"
        base_name = safe_filename(
            project.personal.full_name
            or project.title
            or "CV"
        )

        return {
            "ok": True,
            "directory": str(EXPORTS_DIR),
            "filename": f"{base_name}_CV{extension}",
        }

    def load_photo_preview(
        self,
        path: str,
    ) -> dict:
        try:
            photo = Path(path)

            if (
                not photo.exists()
                or not photo.is_file()
                or photo.suffix.lower() not in IMAGE_EXTENSIONS
            ):
                return {
                    "ok": False,
                    "message": "Choose a PNG, JPG or JPEG image.",
                }

            mime = (
                "image/png"
                if photo.suffix.lower() == ".png"
                else "image/jpeg"
            )

            encoded = base64.b64encode(
                photo.read_bytes()
            ).decode("ascii")

            return {
                "ok": True,
                "path": str(photo.resolve()),
                "name": photo.name,
                "data_uri": f"data:{mime};base64,{encoded}",
            }

        except Exception as exc:
            return {
                "ok": False,
                "message": f"Unable to load this image: {exc}",
            }

    # =========================================================
    # ATS
    # =========================================================

    def analyze_ats(
        self,
        project_data: dict,
    ) -> dict:
        try:
            project = CVProject.from_dict(project_data)
            pdf_audit = self._pdf_exporter.audit_project(project)
            result = run_ats_check(
                project,
                pdf_audit=pdf_audit,
            )

            self._logger.success(
                f"ATS readiness analysis completed ({result['score']}/100)"
            )

            return {
                "ok": True,
                "result": result,
            }

        except Exception as exc:
            self._logger.error(
                "ATS analysis failed.",
                step="ATS analysis",
                exc=exc,
            )

            return {
                "ok": False,
                "message": "CVM could not analyse this CV.",
            }

    # =========================================================
    # CUSTOM EXPORT
    # =========================================================

    def _safe_custom_export_path(
        self,
        directory: str,
        filename: str,
        extension: str,
    ) -> Path:
        folder = Path(directory).expanduser().resolve()

        if not folder.exists() or not folder.is_dir():
            raise ValueError("The selected export folder does not exist.")

        name = Path(filename).name.strip()

        if not name:
            raise ValueError("Enter a file name.")

        if not name.lower().endswith(extension):
            name += extension

        return folder / name

    def export_pdf_to_path(
        self,
        project_data: dict,
        directory: str,
        filename: str,
    ) -> dict:
        try:
            project = CVProject.from_dict(project_data)
            output_path = self._safe_custom_export_path(
                directory,
                filename,
                ".pdf",
            )

            self._logger.info(
                f"PDF generation started: {output_path.name}"
            )

            result = self._pdf_exporter.export(
                project,
                output_path,
            )

            if not result.get("ok"):
                self._logger.error(
                    result.get("message", "PDF export failed."),
                    step="PDF export",
                    context=result.get("technical_output", "")[-3000:],
                )
                return result

            self._record_export(
                output_path,
                "PDF",
            )

            if result.get("validation", {}).get("passed"):
                self._logger.success(
                    "PDF exported and ATS text extraction validation passed"
                )
            else:
                self._logger.warning(
                    "PDF exported, but parsing validation detected a potential issue"
                )

            return result

        except Exception as exc:
            self._logger.error(
                "PDF export failed.",
                step="PDF export",
                exc=exc,
            )

            return {
                "ok": False,
                "message": str(exc) or "PDF export failed.",
            }

    def export_docx_to_path(
        self,
        project_data: dict,
        directory: str,
        filename: str,
    ) -> dict:
        try:
            project = CVProject.from_dict(project_data)
            output_path = self._safe_custom_export_path(
                directory,
                filename,
                ".docx",
            )

            self._logger.info(
                f"DOCX generation started: {output_path.name}"
            )

            result = self._docx_exporter.export(
                project,
                output_path,
            )

            if result.get("ok"):
                self._record_export(
                    output_path,
                    "DOCX",
                )
                self._logger.success(
                    "DOCX exported successfully"
                )

            return result

        except Exception as exc:
            self._logger.error(
                "DOCX export failed.",
                step="DOCX export",
                exc=exc,
            )

            return {
                "ok": False,
                "message": str(exc) or "DOCX export failed.",
            }

    # Legacy API kept so older UI code does not crash. The CVM 0.4
    # interface uses export_*_to_path instead of native Save dialogs.
    def export_pdf(self, project_data: dict) -> dict:
        defaults = self.get_export_defaults(project_data, "pdf")
        return self.export_pdf_to_path(
            project_data,
            defaults["directory"],
            defaults["filename"],
        )

    def export_docx(self, project_data: dict) -> dict:
        defaults = self.get_export_defaults(project_data, "docx")
        return self.export_docx_to_path(
            project_data,
            defaults["directory"],
            defaults["filename"],
        )

    # =========================================================
    # CVM 0.7 - ADVANCED LATEX WORKSPACE
    # =========================================================

    def get_latex_workspace_state(self) -> dict:
        return {
            "ok": True,
            **self._latex_workspace.capability(),
        }

    def get_latex_templates(self) -> dict:
        try:
            return {
                "ok": True,
                "templates": self._latex_workspace.templates(),
                **self._latex_workspace.capability(),
            }
        except Exception as exc:
            self._logger.error(
                "LaTeX template catalog could not be loaded.",
                step="LaTeX workspace",
                exc=exc,
            )
            return {
                "ok": False,
                "message": "CVM could not load the LaTeX template catalog.",
                "templates": [],
            }

    def get_latex_template(self, template_id: str) -> dict:
        try:
            return {
                "ok": True,
                "source": self._latex_workspace.template_source(template_id),
                **self._latex_workspace.capability(),
            }
        except Exception as exc:
            self._logger.error(
                "LaTeX template could not be loaded.",
                step="LaTeX workspace",
                exc=exc,
            )
            return {
                "ok": False,
                "message": str(exc) or "CVM could not load this LaTeX template.",
            }

    def get_latex_starter_template(self) -> dict:
        try:
            return {
                "ok": True,
                "source": self._latex_workspace.starter_source(),
                **self._latex_workspace.capability(),
            }
        except Exception as exc:
            self._logger.error(
                "LaTeX starter template could not be loaded.",
                step="LaTeX workspace",
                exc=exc,
            )
            return {
                "ok": False,
                "message": "CVM could not load the starter LaTeX template.",
            }

    def compile_latex_preview(self, source: str) -> dict:
        try:
            self._logger.info(
                "Manual LaTeX preview compilation started"
            )
            result = self._latex_workspace.preview(source)

            if result.get("ok"):
                self._logger.success(
                    "Manual LaTeX preview compiled successfully"
                )
            else:
                self._logger.warning(
                    result.get("message", "LaTeX preview compilation failed.")
                )

            return result
        except Exception as exc:
            self._logger.error(
                "LaTeX preview failed.",
                step="LaTeX workspace preview",
                exc=exc,
            )
            return {
                "ok": False,
                "message": "CVM could not compile this LaTeX source.",
            }

    def save_latex_source(
        self,
        source: str,
        directory: str,
        filename: str,
    ) -> dict:
        try:
            output_path = self._safe_custom_export_path(
                directory,
                filename,
                ".tex",
            )
            result = self._latex_workspace.save_source(
                source,
                output_path,
            )

            if result.get("ok"):
                self._logger.success(
                    f"LaTeX source saved: {output_path.name}"
                )

            return result
        except Exception as exc:
            self._logger.error(
                "LaTeX source save failed.",
                step="Save LaTeX source",
                exc=exc,
            )
            return {
                "ok": False,
                "message": str(exc) or "CVM could not save this LaTeX source.",
            }

    def export_latex_pdf(
        self,
        source: str,
        directory: str,
        filename: str,
    ) -> dict:
        try:
            output_path = self._safe_custom_export_path(
                directory,
                filename,
                ".pdf",
            )
            self._logger.info(
                f"Custom LaTeX PDF generation started: {output_path.name}"
            )
            result = self._latex_workspace.export_pdf(
                source,
                output_path,
            )

            if result.get("ok"):
                self._record_export(
                    output_path,
                    "PDF",
                )
                self._logger.success(
                    "Custom LaTeX PDF exported successfully"
                )
            else:
                self._logger.warning(
                    result.get("message", "Custom LaTeX PDF export failed.")
                )

            return result
        except Exception as exc:
            self._logger.error(
                "Custom LaTeX PDF export failed.",
                step="Custom LaTeX PDF export",
                exc=exc,
            )
            return {
                "ok": False,
                "message": str(exc) or "CVM could not export this LaTeX PDF.",
            }

    # =========================================================
    # CVM 0.6 - IN-APP EXPORTS / LOGS MANAGERS
    # =========================================================

    def _load_export_history(self) -> list[dict]:
        try:
            if not EXPORT_HISTORY_FILE.exists():
                return []

            raw = json.loads(
                EXPORT_HISTORY_FILE.read_text(
                    encoding="utf-8",
                )
            )

            return raw if isinstance(raw, list) else []

        except Exception:
            return []

    def _save_export_history(
        self,
        items: list[dict],
    ) -> None:
        try:
            EXPORT_HISTORY_FILE.parent.mkdir(
                parents=True,
                exist_ok=True,
            )

            EXPORT_HISTORY_FILE.write_text(
                json.dumps(
                    items[:100],
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )

        except Exception:
            pass

    def _record_export(
        self,
        path: Path,
        export_type: str,
    ) -> None:
        path = Path(path).resolve()
        existing = self._load_export_history()

        record = {
            "path": str(path),
            "type": str(export_type).upper(),
            "created_at": __import__(
                "datetime"
            ).datetime.now().isoformat(
                timespec="seconds"
            ),
        }

        filtered = [
            item
            for item in existing
            if item.get("path") != str(path)
        ]

        self._save_export_history(
            [record, *filtered]
        )

    def list_exports(self) -> dict:
        """
        Return export history for the in-app Exports page.

        Public packaged builds default to:
        ~/Documents/CVM Exports

        Files explicitly exported elsewhere are also kept in history so the
        user can still open them from CVM.
        """
        ensure_runtime_directories()

        history = self._load_export_history()
        seen: set[str] = set()
        items: list[dict] = []

        def add_path(
            file_path: Path,
            export_type: str = "",
            created_at: str = "",
        ) -> None:
            try:
                resolved = file_path.resolve()

                if (
                    not resolved.exists()
                    or not resolved.is_file()
                    or resolved.suffix.lower()
                    not in {".pdf", ".docx"}
                ):
                    return

                key = str(resolved)

                if key in seen:
                    return

                seen.add(key)

                stat = resolved.stat()

                items.append(
                    {
                        "name": resolved.name,
                        "path": key,
                        "type": (
                            export_type
                            or resolved.suffix[1:]
                        ).upper(),
                        "size_bytes": stat.st_size,
                        "modified_at": __import__(
                            "datetime"
                        ).datetime.fromtimestamp(
                            stat.st_mtime
                        ).isoformat(
                            timespec="minutes"
                        ),
                        "created_at": created_at,
                        "folder": str(
                            resolved.parent
                        ),
                    }
                )

            except OSError:
                return

        for item in history:
            path_text = item.get("path", "")

            if path_text:
                add_path(
                    Path(path_text),
                    item.get("type", ""),
                    item.get("created_at", ""),
                )

        # Also discover files in the default CVM export folder in case the
        # history file was deleted/reset.
        try:
            for file_path in sorted(
                EXPORTS_DIR.iterdir(),
                key=lambda value: (
                    value.stat().st_mtime
                    if value.exists()
                    else 0
                ),
                reverse=True,
            ):
                add_path(file_path)
        except OSError:
            pass

        items.sort(
            key=lambda item: (
                item.get("modified_at", "")
            ),
            reverse=True,
        )

        return {
            "ok": True,
            "directory": str(EXPORTS_DIR),
            "items": items[:100],
        }

    def get_logs_view(self) -> dict:
        """
        Data for the in-app Logs page. No folder is opened automatically.
        """
        ensure_runtime_directories()

        files = []

        try:
            candidates = sorted(
                LOGS_DIR.glob("*.log"),
                key=lambda path: path.stat().st_mtime,
                reverse=True,
            )

            for path in candidates[:30]:
                try:
                    stat = path.stat()

                    files.append(
                        {
                            "name": path.name,
                            "path": str(path.resolve()),
                            "size_bytes": stat.st_size,
                            "modified_at": __import__(
                                "datetime"
                            ).datetime.fromtimestamp(
                                stat.st_mtime
                            ).isoformat(
                                timespec="minutes"
                            ),
                        }
                    )
                except OSError:
                    continue

        except OSError:
            pass

        return {
            "ok": True,
            "directory": str(LOGS_DIR),
            "events": self._logger.get_events(),
            "files": files,
            "last_error_report": self._logger.get_last_error_report(),
        }

    def read_log_file(
        self,
        path: str,
        max_chars: int = 50000,
    ) -> dict:
        try:
            file_path = Path(path).resolve()

            if (
                not file_path.exists()
                or not file_path.is_file()
                or file_path.suffix.lower() != ".log"
            ):
                return {
                    "ok": False,
                    "message": "The selected log file does not exist.",
                }

            # Only allow files inside CVM's own logs directory.
            logs_root = LOGS_DIR.resolve()

            if logs_root not in file_path.parents:
                return {
                    "ok": False,
                    "message": "This file is outside the CVM logs directory.",
                }

            text = file_path.read_text(
                encoding="utf-8",
                errors="replace",
            )

            max_chars = max(
                1000,
                min(
                    200000,
                    int(max_chars),
                ),
            )

            return {
                "ok": True,
                "name": file_path.name,
                "path": str(file_path),
                "text": text[-max_chars:],
            }

        except Exception as exc:
            return {
                "ok": False,
                "message": str(exc)
                or "Unable to read this log file.",
            }

    # =========================================================
    # OPEN FILES / FOLDERS
    # =========================================================

    def open_file(self, path: str) -> dict:
        try:
            file_path = Path(path)

            if not file_path.exists() or not file_path.is_file():
                return {
                    "ok": False,
                    "message": "The exported file no longer exists.",
                }

            os.startfile(str(file_path))
            self._logger.info(
                f"Opened file: {file_path.name}"
            )
            return {"ok": True}

        except Exception as exc:
            return {
                "ok": False,
                "message": str(exc),
            }

    def open_parent_folder(self, path: str) -> dict:
        try:
            target = Path(path)
            folder = target if target.is_dir() else target.parent
            os.startfile(str(folder))
            return {"ok": True}

        except Exception as exc:
            return {
                "ok": False,
                "message": str(exc),
            }

    def open_exports_folder(self) -> dict:
        try:
            ensure_runtime_directories()
            os.startfile(str(EXPORTS_DIR))
            self._logger.info("Exports folder opened")
            return {"ok": True}

        except Exception as exc:
            self._logger.error(
                "Unable to open exports folder.",
                step="Open exports folder",
                exc=exc,
            )
            return {
                "ok": False,
                "message": "Unable to open exports folder.",
            }

    def open_logs_folder(self) -> dict:
        try:
            ensure_runtime_directories()
            os.startfile(str(LOGS_DIR))
            self._logger.info("Logs folder opened")
            return {"ok": True}

        except Exception as exc:
            self._logger.error(
                "Unable to open logs folder.",
                step="Open logs folder",
                exc=exc,
            )
            return {
                "ok": False,
                "message": "Unable to open logs folder.",
            }


# ============================================================
# CVM 0.5 API EXTENSION METHODS
# Attached to AppBridge to keep backward compatibility.
# ============================================================

def _v05_set_dirty_state(self, value: bool) -> dict:
    self._dirty = bool(value)
    return {"ok": True, "dirty": self._dirty}

def _v05_get_dirty_state(self) -> dict:
    return {"ok": True, "dirty": bool(self._dirty)}

def _v05_can_close(self) -> bool:
    return bool(self._allow_close or not self._dirty)

def _v05_confirm_close(self) -> dict:
    self._allow_close = True
    try:
        if self._window:
            self._window.destroy()
    except Exception:
        pass
    return {"ok": True}

def _v05_recent_projects(self) -> dict:
    return {"ok": True, "items": self._v05.recent_projects()}

def _v05_recovery_state(self) -> dict:
    if self._startup_project_loaded:
        return {"ok": True, "available": False}
    return {"ok": True, **self._v05.recovery_state()}

def _v05_recover_autosave(self) -> dict:
    state = self._v05.recovery_state()
    if not state.get("available"):
        return {"ok": False, "message": "No recovery session is available."}
    project = CVProject.from_dict(state["project"])
    self._current_project = project
    self._current_project_path = None
    self._project_active = True
    self._dirty = True
    self._logger.success("Autosave recovery loaded")
    return {"ok": True, "project": project.to_dict()}

def _v05_discard_recovery(self) -> dict:
    return self._v05.discard_recovery()

def _v05_save_project_as(self, project_data: dict, directory: str, filename: str) -> dict:
    try:
        project = CVProject.from_dict(project_data)
        folder = Path(directory).expanduser().resolve()
        folder.mkdir(parents=True, exist_ok=True)
        name = safe_filename(Path(filename).stem or project.title or "CV")
        path = folder / f"{name}{PROJECT_EXTENSION}"
        saved = self._project_manager.save(project, path)
        self._current_project = project
        self._current_project_path = saved
        self._project_active = True
        self._dirty = False
        self._v05.remember_project(saved)
        self._logger.success(f"Project saved as: {saved.name}")
        return {"ok": True, "path": str(saved), "project": project.to_dict()}
    except Exception as exc:
        self._logger.error("Save As failed.", step="Save project as", exc=exc)
        return {"ok": False, "message": "CVM could not save this project copy."}

def _v05_duplicate_project(self, project_data: dict) -> dict:
    try:
        project = CVProject.from_dict(project_data)
        project.id = __import__("uuid").uuid4().hex
        project.title = f"{project.title} - Copy"
        project.created_at = __import__("datetime").datetime.now().isoformat(timespec="seconds")
        project.updated_at = project.created_at
        filename = safe_filename(project.title) + PROJECT_EXTENSION
        path = PROJECTS_DIR / filename
        counter = 2
        while path.exists():
            path = PROJECTS_DIR / f"{safe_filename(project.title)} {counter}{PROJECT_EXTENSION}"
            counter += 1
        saved = self._project_manager.save(project, path)
        self._v05.remember_project(saved)
        return {"ok": True, "path": str(saved), "project": project.to_dict()}
    except Exception as exc:
        self._logger.error("Duplicate CV failed.", step="Duplicate CV", exc=exc)
        return {"ok": False, "message": "CVM could not duplicate this CV."}


def _v05_completion_report(self, project_data: dict) -> dict:
    return {"ok": True, "result": completeness_report(CVProject.from_dict(project_data))}

def _v05_optimizer_report(self, project_data: dict) -> dict:
    return {"ok": True, "result": optimizer_report(CVProject.from_dict(project_data))}

def _v05_bullet_quality_report(self, project_data: dict) -> dict:
    return {"ok": True, "result": bullet_quality_report(CVProject.from_dict(project_data))}

def _v05_template_catalog(self) -> dict:
    return {"ok": True, "items": self._v05.template_catalog()}

def _v05_country_presets(self) -> dict:
    return {"ok": True, "items": self._v05.country_presets()}

def _v05_import_cv_path(self, path: str) -> dict:
    result = self._v05.import_cv(path)
    if result.get("ok"):
        self._current_project = CVProject.from_dict(result["project"])
        self._current_project_path = None
        self._project_active = True
        self._dirty = True
        self._logger.success("Existing CV imported for review")
    return result

def _v05_about(self) -> dict:
    return {"ok": True, **self._v05.about()}

def _v05_check_for_updates(self, manual: bool = True) -> dict:
    return self._updater.check(
        manual=bool(manual)
    )


def _v05_download_update(self) -> dict:
    return self._updater.download_latest()


def _v05_install_update(self, installer_path: str) -> dict:
    result = self._updater.launch_installer(
        installer_path
    )

    if result.get("ok") and self._window:
        def close_after_launch() -> None:
            time.sleep(1.0)
            try:
                self._allow_close = True
                self._window.destroy()
            except Exception:
                pass

        threading.Thread(
            target=close_after_launch,
            name="cvm-update-close",
            daemon=True,
        ).start()

    return result

AppBridge.set_dirty_state = _v05_set_dirty_state
AppBridge.get_dirty_state = _v05_get_dirty_state
AppBridge.can_close = _v05_can_close
AppBridge.confirm_close = _v05_confirm_close
AppBridge.get_recent_projects = _v05_recent_projects
AppBridge.get_recovery_state = _v05_recovery_state
AppBridge.recover_autosave = _v05_recover_autosave
AppBridge.discard_recovery = _v05_discard_recovery
AppBridge.save_project_as = _v05_save_project_as
AppBridge.duplicate_project = _v05_duplicate_project
AppBridge.get_completeness = _v05_completion_report
AppBridge.get_optimizer_report = _v05_optimizer_report
AppBridge.get_bullet_quality = _v05_bullet_quality_report
AppBridge.get_template_catalog = _v05_template_catalog
AppBridge.get_country_presets = _v05_country_presets
AppBridge.import_cv_path = _v05_import_cv_path
AppBridge.get_about = _v05_about
AppBridge.check_for_updates = _v05_check_for_updates
AppBridge.download_update = _v05_download_update
AppBridge.install_update = _v05_install_update
