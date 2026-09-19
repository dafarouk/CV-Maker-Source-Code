from __future__ import annotations

import base64
import shutil
import subprocess
import tempfile
from pathlib import Path

import pymupdf

from src.config import LATEX_TEMPLATES_DIR
from src.latex_runtime import (
    available_latex_engine,
    build_compile_command,
    build_compile_environment,
)


class LatexWorkspace:
    """Isolated raw-LaTeX compile/save/export service for CVM's advanced editor."""

    MAX_SOURCE_CHARS = 300_000
    STARTER_TEMPLATE = LATEX_TEMPLATES_DIR / "custom_starter.tex"

    TEMPLATE_CATALOG = (
        {
            "id": "classic_ats",
            "title": "Classic ATS",
            "description": "Clean single-column CV with maximum readability and selectable text.",
            "category": "ATS-first",
            "layout": "single",
            "accent": "#8B1540",
            "file": "custom_starter.tex",
            "has_photo": False,
            "has_qr": False,
            "ats_note": "ATS-friendly structure",
        },
        {
            "id": "modern_gold",
            "title": "Modern Gold",
            "description": "Premium cream, ink and gold styling with a modern single-column layout.",
            "category": "Modern",
            "layout": "single",
            "accent": "#BC965D",
            "file": "custom_modern_gold.tex",
            "has_photo": False,
            "has_qr": False,
            "ats_note": "Readable, light visual styling",
        },
        {
            "id": "navy_executive",
            "title": "Navy Executive",
            "description": "Executive header with dark navy and gold accents inspired by the CVM brand.",
            "category": "Executive",
            "layout": "single",
            "accent": "#D0AA70",
            "file": "custom_navy_executive.tex",
            "has_photo": False,
            "has_qr": False,
            "ats_note": "Visual header, still text-based",
        },
        {
            "id": "two_column",
            "title": "Two Column",
            "description": "Visual two-column layout with a compact skills and links sidebar.",
            "category": "Visual",
            "layout": "two-column",
            "accent": "#BC965D",
            "file": "custom_two_column.tex",
            "has_photo": False,
            "has_qr": False,
            "ats_note": "More visual, less ATS-focused",
        },
        {
            "id": "photo_profile",
            "title": "Photo Profile",
            "description": "Modern profile CV with a photo area and premium gold details.",
            "category": "Photo",
            "layout": "photo",
            "accent": "#BC965D",
            "file": "custom_photo.tex",
            "has_photo": True,
            "has_qr": False,
            "ats_note": "Best for markets where photo CVs are appropriate",
        },
        {
            "id": "qr_contact",
            "title": "QR Contact",
            "description": "Compact professional CV with a QR code for portfolio or contact details.",
            "category": "QR",
            "layout": "qr",
            "accent": "#D0AA70",
            "file": "custom_qr_contact.tex",
            "has_photo": False,
            "has_qr": True,
            "ats_note": "QR is supplementary, core contact text remains visible",
        },
    )

    def available_engine(self) -> str | None:
        return available_latex_engine()

    def capability(self) -> dict:
        engine = self.available_engine()
        return {
            "available": engine is not None,
            "engine": Path(engine).stem if engine else None,
        }

    def templates(self) -> list[dict]:
        """Return lightweight metadata for the LaTeX template gallery."""
        return [
            {
                key: value
                for key, value in item.items()
                if key != "file"
            }
            for item in self.TEMPLATE_CATALOG
        ]

    def template_source(self, template_id: str) -> str:
        template_id = str(template_id or "").strip().lower()

        template = next(
            (
                item
                for item in self.TEMPLATE_CATALOG
                if item["id"] == template_id
            ),
            None,
        )

        if template is None:
            raise ValueError("Unknown CVM LaTeX template.")

        path = LATEX_TEMPLATES_DIR / template["file"]

        if not path.exists():
            raise FileNotFoundError(
                f"CVM LaTeX template is missing: {path.name}"
            )

        return path.read_text(
            encoding="utf-8",
        )

    def starter_source(self) -> str:
        if not self.STARTER_TEMPLATE.exists():
            raise FileNotFoundError("CVM starter LaTeX template is missing.")

        return self.STARTER_TEMPLATE.read_text(
            encoding="utf-8",
        )

    def _normalize_source(self, source: str) -> str:
        text = str(source or "")

        if len(text) > self.MAX_SOURCE_CHARS:
            raise ValueError(
                "This LaTeX source is too large for the CVM editor."
            )

        if not text.strip():
            raise ValueError("Write or load LaTeX code before compiling.")

        lowered = text.lower()
        if "\\documentclass" not in lowered:
            raise ValueError("The LaTeX source needs a \\documentclass declaration.")
        if "\\begin{document}" not in lowered:
            raise ValueError("The LaTeX source needs \\begin{document}.")
        if "\\end{document}" not in lowered:
            raise ValueError("The LaTeX source needs \\end{document}.")

        return text

    def _compile(
        self,
        source: str,
        working_directory: Path,
    ) -> tuple[Path | None, str]:
        source = self._normalize_source(source)
        latex_engine = self.available_engine()

        if not latex_engine:
            return None, "No supported LaTeX engine was detected."

        working_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        tex_path = working_directory / "main.tex"
        tex_path.write_text(
            source,
            encoding="utf-8",
        )

        command = build_compile_command(
            latex_engine,
            str(tex_path.name),
            working_directory,
            no_shell_escape=True,
        )

        try:
            result = subprocess.run(
                command,
                cwd=working_directory,
                env=build_compile_environment(latex_engine),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=90,
                creationflags=getattr(
                    subprocess,
                    "CREATE_NO_WINDOW",
                    0,
                ),
            )
        except subprocess.TimeoutExpired:
            return None, "LaTeX compilation timed out."

        generated_pdf = working_directory / "main.pdf"

        if (
            result.returncode != 0
            or not generated_pdf.exists()
        ):
            return None, result.stdout[-12_000:]

        return generated_pdf, result.stdout[-12_000:]

    @staticmethod
    def _render_pages(
        pdf_path: Path,
        *,
        scale: float = 1.35,
        max_pages: int = 6,
    ) -> list[dict]:
        document = pymupdf.open(pdf_path)
        pages: list[dict] = []

        try:
            matrix = pymupdf.Matrix(scale, scale)

            for page_index in range(
                min(document.page_count, max_pages)
            ):
                page = document.load_page(page_index)
                pixmap = page.get_pixmap(
                    matrix=matrix,
                    alpha=False,
                )
                encoded = base64.b64encode(
                    pixmap.tobytes("png")
                ).decode("ascii")

                pages.append(
                    {
                        "page": page_index + 1,
                        "data_uri": f"data:image/png;base64,{encoded}",
                        "width": pixmap.width,
                        "height": pixmap.height,
                    }
                )
        finally:
            document.close()

        return pages

    def preview(self, source: str) -> dict:
        if not self.available_engine():
            return {
                "ok": False,
                "code": "latex_missing",
                "message": "No supported LaTeX engine was detected.",
            }

        try:
            with tempfile.TemporaryDirectory(
                prefix="cvm_latex_preview_"
            ) as temp_directory:
                root = Path(temp_directory)
                pdf_path, output = self._compile(
                    source,
                    root,
                )

                if pdf_path is None:
                    return {
                        "ok": False,
                        "code": "latex_compile_error",
                        "message": "LaTeX compilation failed.",
                        "technical_output": output,
                    }

                document = pymupdf.open(pdf_path)
                page_count = document.page_count
                document.close()

                return {
                    "ok": True,
                    "pages": self._render_pages(pdf_path),
                    "page_count": page_count,
                    "technical_output": output,
                }
        except ValueError as exc:
            return {
                "ok": False,
                "code": "latex_source_invalid",
                "message": str(exc),
            }
        except Exception as exc:
            return {
                "ok": False,
                "code": "latex_preview_error",
                "message": f"CVM could not compile this LaTeX source: {exc}",
            }

    def save_source(
        self,
        source: str,
        destination: Path,
    ) -> dict:
        try:
            source = self._normalize_source(source)
            destination = Path(destination)
            destination.parent.mkdir(
                parents=True,
                exist_ok=True,
            )
            destination.write_text(
                source,
                encoding="utf-8",
            )
            return {
                "ok": True,
                "tex_path": str(destination),
            }
        except Exception as exc:
            return {
                "ok": False,
                "message": str(exc) or "Unable to save this LaTeX source.",
            }

    def export_pdf(
        self,
        source: str,
        destination: Path,
    ) -> dict:
        if not self.available_engine():
            return {
                "ok": False,
                "code": "latex_missing",
                "message": "No supported LaTeX engine was detected.",
            }

        try:
            destination = Path(destination)
            destination.parent.mkdir(
                parents=True,
                exist_ok=True,
            )

            with tempfile.TemporaryDirectory(
                prefix="cvm_latex_export_"
            ) as temp_directory:
                root = Path(temp_directory)
                pdf_path, output = self._compile(
                    source,
                    root,
                )

                if pdf_path is None:
                    return {
                        "ok": False,
                        "code": "latex_compile_error",
                        "message": "LaTeX compilation failed.",
                        "technical_output": output,
                    }

                shutil.copy2(
                    pdf_path,
                    destination,
                )

                document = pymupdf.open(pdf_path)
                page_count = document.page_count
                document.close()

                return {
                    "ok": True,
                    "pdf_path": str(destination),
                    "pages": self._render_pages(pdf_path),
                    "page_count": page_count,
                    "technical_output": output,
                }
        except ValueError as exc:
            return {
                "ok": False,
                "code": "latex_source_invalid",
                "message": str(exc),
            }
        except Exception as exc:
            return {
                "ok": False,
                "code": "latex_export_error",
                "message": f"CVM could not export this LaTeX source: {exc}",
            }
