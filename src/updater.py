from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable

from packaging.version import InvalidVersion, Version

from src.config import (
    APP_FULL_NAME,
    APP_VERSION,
    GITHUB_REPOSITORY,
    UPDATE_CACHE_FILE,
    UPDATE_CHECK_INTERVAL_HOURS,
    UPDATE_DOWNLOAD_DIR,
    UPDATE_HASH_ASSET_NAME,
    UPDATE_SUCCESS_FILE,
)


class UpdateService:
    """GitHub Releases based updater for public CV Maker builds."""

    def __init__(self) -> None:
        UPDATE_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
        self._capture_legacy_completed_update()
        self._cleanup_downloads()

    def _capture_legacy_completed_update(self) -> None:
        """
        Detect an update completed by an older CVM updater that did not yet
        create an explicit success marker.

        CVM 1.0.1 stores the previous/current release pair in update_check.json
        and leaves the downloaded Setup EXE in the update directory. When the
        newly installed version starts, those two facts are enough to prove an
        in-app update completed successfully.
        """
        if UPDATE_SUCCESS_FILE.exists():
            return

        cache = self._read_json(UPDATE_CACHE_FILE, {})
        previous = str(cache.get("current") or "").strip().lstrip("vV")
        latest = str(cache.get("latest") or "").strip().lstrip("vV")

        if not previous or not latest:
            return

        current_version = self._version(APP_VERSION)
        previous_version = self._version(previous)
        latest_version = self._version(latest)

        if (
            current_version is None
            or previous_version is None
            or latest_version is None
            or latest_version != current_version
            or previous_version >= current_version
        ):
            return

        expected_names = {
            f"CV-Maker-Setup-{APP_VERSION}.exe".casefold(),
            f"CV-Maker-Setup-v{APP_VERSION}.exe".casefold(),
        }
        installer = next(
            (
                path
                for path in UPDATE_DOWNLOAD_DIR.glob("CV-Maker-Setup-*.exe")
                if path.name.casefold() in expected_names
            ),
            None,
        )

        if installer is None:
            return

        self._write_json(
            UPDATE_SUCCESS_FILE,
            {
                "status": "completed",
                "from_version": previous,
                "to_version": APP_VERSION,
                "notes": "",
                "release_url": (
                    f"https://github.com/{GITHUB_REPOSITORY}/releases/tag/v{APP_VERSION}"
                ),
                "installer_name": installer.name,
                "legacy_detected": True,
                "created_at": time.time(),
            },
        )

    def _write_pending_update(self, release: dict, installer_name: str) -> None:
        self._write_json(
            UPDATE_SUCCESS_FILE,
            {
                "status": "pending",
                "from_version": APP_VERSION,
                "to_version": str(release.get("latest") or ""),
                "notes": str(release.get("notes") or ""),
                "release_url": str(release.get("release_url") or ""),
                "installer_name": installer_name,
                "created_at": time.time(),
            },
        )

    def _mark_install_started(self, installer_name: str) -> None:
        marker = self._read_json(UPDATE_SUCCESS_FILE, {})
        if not isinstance(marker, dict):
            marker = {}

        marker.update(
            {
                "status": "installing",
                "installer_name": installer_name,
                "install_started_at": time.time(),
            }
        )
        self._write_json(UPDATE_SUCCESS_FILE, marker)

    def consume_completed_update(self) -> dict | None:
        marker = self._read_json(UPDATE_SUCCESS_FILE, {})
        if not isinstance(marker, dict) or not marker:
            return None

        target_text = str(marker.get("to_version") or "").strip().lstrip("vV")
        source_text = str(marker.get("from_version") or "").strip().lstrip("vV")
        target_version = self._version(target_text)
        current_version = self._version(APP_VERSION)

        if target_version is None or current_version is None:
            return None

        if target_version != current_version:
            return None

        if source_text:
            source_version = self._version(source_text)
            if source_version is not None and source_version >= current_version:
                return None

        payload = {
            "from_version": source_text,
            "to_version": APP_VERSION,
            "notes": str(marker.get("notes") or ""),
            "release_url": str(marker.get("release_url") or ""),
            "legacy_detected": bool(marker.get("legacy_detected")),
        }

        try:
            UPDATE_SUCCESS_FILE.unlink(missing_ok=True)
        except OSError:
            pass

        return payload

    def _cleanup_downloads(self) -> None:
        # Remove interrupted downloads and installers that are no longer
        # newer than the running CV Maker version.
        for partial in UPDATE_DOWNLOAD_DIR.glob("*.part"):
            try:
                partial.unlink()
            except OSError:
                pass

        current = self._version(APP_VERSION)
        if current is None:
            return

        pattern = re.compile(
            r"^CV-Maker-Setup-v?(?P<version>.+)\.exe$",
            flags=re.IGNORECASE,
        )

        for installer in UPDATE_DOWNLOAD_DIR.glob("CV-Maker-Setup-*.exe"):
            match = pattern.match(installer.name)
            if not match:
                continue

            version = self._version(match.group("version"))
            if version is None or version > current:
                continue

            try:
                installer.unlink()
            except OSError:
                # The installer may still be running immediately after an
                # update. A later CVM launch will clean it up.
                pass

    # ========================================================
    # INTERNAL HELPERS
    # ========================================================

    @staticmethod
    def _github_headers() -> dict[str, str]:
        return {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2026-03-10",
            "User-Agent": f"{APP_FULL_NAME}/{APP_VERSION}",
        }

    @staticmethod
    def _read_json(path: Path, fallback: Any) -> Any:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return fallback

    @staticmethod
    def _write_json(path: Path, payload: Any) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(path.suffix + ".tmp")
        temp.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        temp.replace(path)

    @staticmethod
    def _version(value: str) -> Version | None:
        text = str(value or "").strip().lstrip("vV")
        try:
            return Version(text)
        except InvalidVersion:
            return None

    @staticmethod
    def _asset_by_name(assets: list[dict], name: str) -> dict | None:
        wanted = name.casefold()
        for asset in assets:
            if str(asset.get("name", "")).casefold() == wanted:
                return asset
        return None

    @staticmethod
    def _setup_asset(assets: list[dict], version: str) -> dict | None:
        exact_name = f"CV-Maker-Setup-{version}.exe"
        exact = UpdateService._asset_by_name(assets, exact_name)
        if exact:
            return exact

        # Safe fallback for a release whose filename contains an optional "v".
        candidates = []
        for asset in assets:
            name = str(asset.get("name", ""))
            lowered = name.casefold()
            if (
                lowered.endswith(".exe")
                and "cv-maker" in lowered
                and "setup" in lowered
            ):
                candidates.append(asset)

        return candidates[0] if len(candidates) == 1 else None

    def _fetch_latest_release(self) -> dict:
        if not GITHUB_REPOSITORY:
            return {
                "ok": False,
                "configured": False,
                "message": "GitHub repository is not configured yet.",
            }

        url = (
            f"https://api.github.com/repos/{GITHUB_REPOSITORY}"
            "/releases/latest"
        )
        request = urllib.request.Request(
            url,
            headers=self._github_headers(),
        )

        try:
            with urllib.request.urlopen(request, timeout=8) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return {
                    "ok": False,
                    "configured": True,
                    "message": (
                        "No public GitHub release was found yet. "
                        "Publish the first CV Maker release and try again."
                    ),
                }
            return {
                "ok": False,
                "configured": True,
                "message": f"GitHub returned HTTP {exc.code}.",
            }
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            return {
                "ok": False,
                "configured": True,
                "message": f"Unable to contact GitHub: {exc}",
            }

        latest_text = str(payload.get("tag_name", "")).strip().lstrip("vV")
        latest_version = self._version(latest_text)
        current_version = self._version(APP_VERSION)

        if latest_version is None:
            return {
                "ok": False,
                "configured": True,
                "message": "The latest GitHub release has an invalid version tag.",
            }

        if current_version is None:
            return {
                "ok": False,
                "configured": True,
                "message": "The current CV Maker version is invalid.",
            }

        assets = payload.get("assets") or []
        setup = self._setup_asset(assets, latest_text)
        hashes = self._asset_by_name(assets, UPDATE_HASH_ASSET_NAME)

        setup_digest = ""
        if setup:
            digest = str(setup.get("digest", "") or "")
            if digest.lower().startswith("sha256:"):
                setup_digest = digest.split(":", 1)[1].strip().lower()

        available = latest_version > current_version
        install_ready = bool(
            available
            and setup
            and setup.get("browser_download_url")
            and (setup_digest or hashes)
        )

        return {
            "ok": True,
            "configured": True,
            "current": APP_VERSION,
            "latest": latest_text,
            "available": available,
            "name": str(payload.get("name") or f"CV Maker {latest_text}"),
            "notes": str(payload.get("body") or "").strip(),
            "published_at": str(payload.get("published_at") or ""),
            "release_url": str(payload.get("html_url") or ""),
            "setup_name": str(setup.get("name") or "") if setup else "",
            "setup_url": str(setup.get("browser_download_url") or "") if setup else "",
            "setup_size": int(setup.get("size") or 0) if setup else 0,
            "setup_digest": setup_digest,
            "hash_url": str(hashes.get("browser_download_url") or "") if hashes else "",
            "install_ready": install_ready,
        }

    # ========================================================
    # PUBLIC CHECK
    # ========================================================

    def check(self, manual: bool = False) -> dict:
        completed_update = self.consume_completed_update()

        if not GITHUB_REPOSITORY:
            return {
                "ok": False,
                "configured": False,
                "message": "GitHub repository is not configured yet.",
                "completed_update": completed_update,
            }

        cache = self._read_json(UPDATE_CACHE_FILE, {})
        now = time.time()
        interval_seconds = max(1, UPDATE_CHECK_INTERVAL_HOURS) * 3600
        last_checked = float(cache.get("last_checked") or 0)

        if (
            not manual
            and last_checked > 0
            and (now - last_checked) < interval_seconds
        ):
            return {
                "ok": True,
                "configured": True,
                "skipped": True,
                "available": False,
                "next_check_in_seconds": int(
                    max(0, interval_seconds - (now - last_checked))
                ),
                "completed_update": completed_update,
            }

        result = self._fetch_latest_release()
        result["completed_update"] = completed_update

        if result.get("ok"):
            self._write_json(
                UPDATE_CACHE_FILE,
                {
                    "last_checked": now,
                    "current": APP_VERSION,
                    "latest": result.get("latest", ""),
                    "available": bool(result.get("available")),
                },
            )

        return result

    # ========================================================
    # DOWNLOAD + VERIFICATION
    # ========================================================

    def _download_text(self, url: str) -> str:
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": f"{APP_FULL_NAME}/{APP_VERSION}",
            },
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.read().decode("utf-8", errors="replace")

    def _expected_hash_from_file(self, url: str, setup_name: str) -> str:
        if not url:
            return ""

        try:
            content = self._download_text(url)
        except Exception:
            return ""

        setup_lower = setup_name.casefold()
        for line in content.splitlines():
            stripped = line.strip()
            if not stripped or setup_lower not in stripped.casefold():
                continue

            match = re.match(r"^([0-9a-fA-F]{64})\s+", stripped)
            if match:
                return match.group(1).lower()

        return ""

    @staticmethod
    def _emit_progress(
        callback: Callable[[dict[str, Any]], None] | None,
        payload: dict[str, Any],
    ) -> None:
        if callback is None:
            return
        try:
            callback(payload)
        except Exception:
            # Progress reporting must never break a valid update download.
            pass

    def download_latest(
        self,
        progress_callback: Callable[[dict[str, Any]], None] | None = None,
    ) -> dict:
        self._emit_progress(
            progress_callback,
            {
                "phase": "preparing",
                "percent": 0,
                "message": "Preparing the update download...",
            },
        )

        release = self._fetch_latest_release()
        if not release.get("ok"):
            return release

        if not release.get("available"):
            return {
                "ok": False,
                "message": "CV Maker is already up to date.",
            }

        setup_url = str(release.get("setup_url") or "")
        setup_name = str(release.get("setup_name") or "")
        if not setup_url or not setup_name:
            return {
                "ok": False,
                "message": (
                    "The latest release does not contain the CV Maker Setup EXE."
                ),
                "release_url": release.get("release_url", ""),
            }

        expected_hash = str(release.get("setup_digest") or "").lower()
        if not expected_hash:
            expected_hash = self._expected_hash_from_file(
                str(release.get("hash_url") or ""),
                setup_name,
            )

        if not expected_hash:
            return {
                "ok": False,
                "message": (
                    "The update could not be verified because its SHA-256 "
                    "checksum is missing."
                ),
                "release_url": release.get("release_url", ""),
            }

        UPDATE_DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

        # Keep only the installer currently being downloaded/installed.
        for old in UPDATE_DOWNLOAD_DIR.glob("CV-Maker-Setup-*.exe"):
            try:
                old.unlink()
            except OSError:
                pass

        target = UPDATE_DOWNLOAD_DIR / setup_name
        partial = target.with_suffix(target.suffix + ".part")

        digest = hashlib.sha256()
        request = urllib.request.Request(
            setup_url,
            headers={
                "User-Agent": f"{APP_FULL_NAME}/{APP_VERSION}",
            },
        )

        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                header_size = 0
                try:
                    header_size = int(response.headers.get("Content-Length") or 0)
                except (TypeError, ValueError):
                    header_size = 0

                total_bytes = header_size or int(release.get("setup_size") or 0)
                downloaded_bytes = 0

                self._emit_progress(
                    progress_callback,
                    {
                        "phase": "download",
                        "percent": 0,
                        "downloaded_bytes": 0,
                        "total_bytes": total_bytes,
                        "message": "Downloading the verified CV Maker installer...",
                    },
                )

                with partial.open("wb") as handle:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        handle.write(chunk)
                        digest.update(chunk)
                        downloaded_bytes += len(chunk)

                        percent = 0
                        if total_bytes > 0:
                            percent = min(100, int(downloaded_bytes * 100 / total_bytes))

                        self._emit_progress(
                            progress_callback,
                            {
                                "phase": "download",
                                "percent": percent,
                                "downloaded_bytes": downloaded_bytes,
                                "total_bytes": total_bytes,
                                "message": "Downloading the verified CV Maker installer...",
                            },
                        )

                self._emit_progress(
                    progress_callback,
                    {
                        "phase": "verify",
                        "percent": 100,
                        "downloaded_bytes": downloaded_bytes,
                        "total_bytes": total_bytes or downloaded_bytes,
                        "message": "Download complete. Verifying SHA-256 integrity...",
                    },
                )
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            try:
                partial.unlink(missing_ok=True)
            except OSError:
                pass
            self._emit_progress(
                progress_callback,
                {
                    "phase": "error",
                    "percent": 0,
                    "message": f"Update download failed: {exc}",
                },
            )
            return {
                "ok": False,
                "message": f"Update download failed: {exc}",
            }

        actual_hash = digest.hexdigest().lower()
        if actual_hash != expected_hash:
            try:
                partial.unlink(missing_ok=True)
            except OSError:
                pass
            self._emit_progress(
                progress_callback,
                {
                    "phase": "error",
                    "percent": 100,
                    "message": "The downloaded update failed SHA-256 verification.",
                },
            )
            return {
                "ok": False,
                "message": "The downloaded update failed the SHA-256 verification.",
            }

        partial.replace(target)
        self._write_pending_update(
            release,
            setup_name,
        )

        self._emit_progress(
            progress_callback,
            {
                "phase": "verified",
                "percent": 100,
                "message": "Update downloaded and verified successfully.",
            },
        )

        return {
            "ok": True,
            "path": str(target),
            "version": release.get("latest", ""),
            "name": setup_name,
            "sha256": actual_hash,
            "notes": str(release.get("notes") or ""),
            "release_url": str(release.get("release_url") or ""),
        }

    # ========================================================
    # INSTALL
    # ========================================================

    def launch_installer(self, path_text: str) -> dict:
        if sys.platform != "win32":
            return {
                "ok": False,
                "message": "Automatic installation is available on Windows only.",
            }

        try:
            path = Path(path_text).expanduser().resolve()
            root = UPDATE_DOWNLOAD_DIR.resolve()
        except OSError:
            return {
                "ok": False,
                "message": "The downloaded installer path is invalid.",
            }

        try:
            path.relative_to(root)
        except ValueError:
            return {
                "ok": False,
                "message": "CVM refused to launch an installer outside its update folder.",
            }

        if not path.exists() or path.suffix.lower() != ".exe":
            return {
                "ok": False,
                "message": "The downloaded installer could not be found.",
            }

        creationflags = 0
        creationflags |= getattr(subprocess, "DETACHED_PROCESS", 0)
        creationflags |= getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)

        self._mark_install_started(path.name)

        try:
            subprocess.Popen(
                [
                    str(path),
                    "/SILENT",
                    "/SUPPRESSMSGBOXES",
                    "/NORESTART",
                    "/CLOSEAPPLICATIONS",
                ],
                cwd=str(path.parent),
                close_fds=True,
                creationflags=creationflags,
            )
        except OSError as exc:
            return {
                "ok": False,
                "message": f"Unable to start the update installer: {exc}",
            }

        return {
            "ok": True,
            "message": "The update installer was started.",
        }
