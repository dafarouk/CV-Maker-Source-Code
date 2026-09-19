from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
import traceback
import uuid

from src.config import LOGS_DIR


@dataclass
class LogEvent:
    timestamp: str
    level: str
    message: str

    def as_dict(self) -> dict:
        return asdict(self)


class AppLogger:
    """
    Lightweight CVM logger.

    Normal activity stays in a small in-memory ring so the application does
    not constantly write to disk. Warnings and errors are persisted because
    they are the useful diagnostics when a user reports a problem.
    """

    MAX_SESSION_EVENTS = 200

    def __init__(self, on_event=None) -> None:
        LOGS_DIR.mkdir(parents=True, exist_ok=True)

        self._on_event = on_event
        self._events: list[LogEvent] = []
        self._last_error_report = ""

        self._log_path: Path = (
            LOGS_DIR
            / f"cvm_{datetime.now():%Y-%m-%d}.log"
        )

    def set_callback(self, callback) -> None:
        self._on_event = callback

    def _remember(self, event: LogEvent) -> None:
        self._events.append(event)

        overflow = len(self._events) - self.MAX_SESSION_EVENTS
        if overflow > 0:
            del self._events[:overflow]

    def _persist_line(self, event: LogEvent) -> None:
        try:
            with self._log_path.open(
                "a",
                encoding="utf-8",
            ) as handle:
                handle.write(
                    f"[{datetime.now():%Y-%m-%d %H:%M:%S}] "
                    f"[{event.level}] "
                    f"{event.message}\n"
                )
        except Exception:
            pass

    def _emit(
        self,
        level: str,
        message: str,
        *,
        persist: bool = False,
    ) -> LogEvent:
        event = LogEvent(
            timestamp=datetime.now().strftime("%H:%M:%S"),
            level=level.upper(),
            message=str(message),
        )

        self._remember(event)

        if persist:
            self._persist_line(event)

        if self._on_event:
            try:
                self._on_event(event.as_dict())
            except Exception:
                pass

        return event

    def info(self, message: str) -> LogEvent:
        return self._emit(
            "INFO",
            message,
            persist=False,
        )

    def success(self, message: str) -> LogEvent:
        return self._emit(
            "SUCCESS",
            message,
            persist=False,
        )

    def warning(self, message: str) -> LogEvent:
        return self._emit(
            "WARNING",
            message,
            persist=True,
        )

    def error(
        self,
        message: str,
        *,
        step: str = "Unknown",
        context: str = "",
        exc: Exception | None = None,
    ) -> str:
        error_id = (
            datetime.now().strftime("%Y%m%d-%H%M%S")
            + "-"
            + uuid.uuid4().hex[:6]
        )

        technical_type = (
            type(exc).__name__
            if exc
            else "ApplicationError"
        )

        technical_message = (
            str(exc)
            if exc
            else message
        )

        trace = ""

        if exc:
            trace = "".join(
                traceback.format_exception(
                    type(exc),
                    exc,
                    exc.__traceback__,
                )
            )

        report = (
            "CVM - TECHNICAL ERROR REPORT\n"
            "========================================\n"
            f"Error ID: {error_id}\n"
            f"Date: {datetime.now():%Y-%m-%d %H:%M:%S}\n"
            f"Step: {step}\n"
            f"Context: {context or '-'}\n"
            f"User message: {message}\n"
            f"Technical type: {technical_type}\n"
            f"Technical message: {technical_message}\n"
        )

        if trace:
            report += (
                "\nTRACEBACK\n"
                "----------------------------------------\n"
                f"{trace}"
            )

        self._last_error_report = report

        self._emit(
            "ERROR",
            message,
            persist=True,
        )

        try:
            with self._log_path.open(
                "a",
                encoding="utf-8",
            ) as handle:
                handle.write(
                    "\n"
                    + report
                    + "\n"
                )
        except Exception:
            pass

        return report

    def get_events(self) -> list[dict]:
        return [
            event.as_dict()
            for event in self._events
        ]

    def get_text_log(self) -> str:
        return "\n".join(
            f"[{event.timestamp}] "
            f"[{event.level}] "
            f"{event.message}"
            for event in self._events
        )

    def get_last_error_report(self) -> str:
        return self._last_error_report

    @property
    def log_path(self) -> Path:
        return self._log_path
