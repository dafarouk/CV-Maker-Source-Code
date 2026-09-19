from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

import pymupdf

from src.cv_engine import CVEngine
from src.latex_runtime import (
    available_latex_engine,
    build_compile_command,
    build_compile_environment,
)
from src.models import CVProject
from src.project_manager import safe_filename


class PDFExporter:
    """Generate, auto-fit and validate CV PDFs from LaTeX."""

    def __init__(self) -> None:
        self._engine = CVEngine()

    def available_engine(self) -> str | None:
        return available_latex_engine()

    def capability(self) -> dict:
        engine = self.available_engine()

        return {
            "available": engine is not None,
            "engine": Path(engine).stem if engine else None,
        }

    def _compile_source(
        self,
        latex_engine: str,
        latex_source: str,
        working_directory: Path,
    ) -> tuple[Path | None, str]:
        temp_tex = working_directory / "cv.tex"
        temp_tex.write_text(
            latex_source,
            encoding="utf-8",
        )

        command = build_compile_command(
            latex_engine,
            "cv.tex",
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
                timeout=120,
                creationflags=getattr(
                    subprocess,
                    "CREATE_NO_WINDOW",
                    0,
                ),
            )

        except subprocess.TimeoutExpired:
            return None, "LaTeX compilation timed out."

        generated_pdf = working_directory / "cv.pdf"

        if (
            result.returncode != 0
            or not generated_pdf.exists()
        ):
            return None, result.stdout[-12000:]

        return generated_pdf, result.stdout

    def _page_count(self, path: Path) -> int:
        document = pymupdf.open(path)
        count = document.page_count
        document.close()
        return count

    def export(
        self,
        project: CVProject,
        output_target: Path,
    ) -> dict:
        latex_engine = self.available_engine()

        if not latex_engine:
            return {
                "ok": False,
                "code": "latex_missing",
                "message": (
                    "CVM's PDF engine is not available in this build."
                ),
            }

        output_target = Path(output_target)

        base_name = safe_filename(
            project.personal.full_name
            or project.title
            or "CV"
        )

        if output_target.suffix.lower() == ".pdf":
            destination_pdf = output_target
        else:
            destination_pdf = (
                output_target
                / f"{base_name}_CV.pdf"
            )

        destination_pdf.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        requested_pages = 1 if project.design.page_mode == "1" else 2
        compact_levels = (
            range(0, 4)
            if project.design.auto_fit
            else range(0, 1)
        )

        final_pdf: Path | None = None
        final_level = 0
        final_pages = 0
        technical_output = ""

        with tempfile.TemporaryDirectory(
            prefix="cvm_pdf_"
        ) as temp_directory:
            temp_root = Path(temp_directory)

            for compact_level in compact_levels:
                attempt_dir = temp_root / f"fit_{compact_level}"
                attempt_dir.mkdir(
                    parents=True,
                    exist_ok=True,
                )

                latex_source = self._engine.render_latex(
                    project,
                    compact_level=compact_level,
                )

                generated_pdf, technical_output = self._compile_source(
                    latex_engine,
                    latex_source,
                    attempt_dir,
                )

                if generated_pdf is None:
                    return {
                        "ok": False,
                        "code": "latex_compile_error",
                        "message": "LaTeX could not compile the CV.",
                        "technical_output": technical_output,
                    }

                final_pdf = generated_pdf
                final_level = compact_level
                final_pages = self._page_count(
                    generated_pdf
                )

                if final_pages <= requested_pages:
                    break

            if final_pdf is None:
                return {
                    "ok": False,
                    "code": "pdf_missing",
                    "message": "CVM did not produce a PDF file.",
                }

            shutil.copy2(
                final_pdf,
                destination_pdf,
            )

        validation = self.validate(
            destination_pdf,
            project,
        )

        return {
            "ok": True,
            "pdf_path": str(destination_pdf),
            "validation": validation,
            "fit": {
                "requested_pages": requested_pages,
                "actual_pages": final_pages,
                "compact_level": final_level,
                "auto_fit_used": bool(
                    project.design.auto_fit
                    and final_level > 0
                ),
                "fits_requested_pages": (
                    final_pages <= requested_pages
                ),
            },
        }

    def audit_project(
        self,
        project: CVProject,
    ) -> dict:
        """
        Compile the current CV into a temporary PDF and inspect the
        resulting document. Nothing is saved to the user's exports.
        """
        latex_engine = self.available_engine()

        if not latex_engine:
            return {
                "available": False,
                "compiled": False,
                "message": (
                    "LaTeX engine unavailable, so exported-PDF parsing "
                    "could not be verified on this computer."
                ),
            }

        with tempfile.TemporaryDirectory(
            prefix="cvm_ats_audit_"
        ) as temp_directory:
            temp_root = Path(temp_directory)

            latex_source = self._engine.render_latex(
                project,
                compact_level=0,
            )

            generated_pdf, output = self._compile_source(
                latex_engine,
                latex_source,
                temp_root,
            )

            if generated_pdf is None:
                return {
                    "available": True,
                    "compiled": False,
                    "message": "The current CV could not be compiled for ATS verification.",
                    "technical_output": output[-6000:],
                }

            validation = self.validate(
                generated_pdf,
                project,
            )

            return {
                "available": True,
                "compiled": True,
                "message": "Temporary PDF compiled and parsed successfully.",
                **validation,
            }

    def validate(
        self,
        pdf_path: Path,
        project: CVProject,
    ) -> dict:
        try:
            document = pymupdf.open(pdf_path)
            pages = []
            blocks_by_page: list[list[dict]] = []

            for page in document:
                page_text = page.get_text("text")
                pages.append(page_text)

                blocks = []

                for block in page.get_text("blocks"):
                    if len(block) < 5:
                        continue

                    text = str(block[4]).strip()

                    if text:
                        blocks.append(
                            {
                                "x0": round(float(block[0]), 2),
                                "y0": round(float(block[1]), 2),
                                "text": text[:160],
                            }
                        )

                blocks_by_page.append(blocks)

            page_count = document.page_count
            document.close()

            extracted_text = "\n".join(pages).strip()
            expected_name = project.personal.full_name.strip()

            selectable_text = len(extracted_text) >= 30
            name_found = (
                not expected_name
                or expected_name.lower()
                in extracted_text.lower()
            )

            expected_sections = []
            visibility = project.design.section_visibility

            if project.profile and visibility.get("profile", True):
                expected_sections.append("PROFILE")
            if project.experiences and visibility.get("experiences", True):
                expected_sections.append("PROFESSIONAL EXPERIENCE")
            if project.education and visibility.get("education", True):
                expected_sections.append("EDUCATION")
            if project.projects and visibility.get("projects", True):
                expected_sections.append("PROJECTS")
            if project.volunteering and visibility.get("volunteering", True):
                expected_sections.append("VOLUNTEERING")
            if project.skills and visibility.get("skills", True):
                expected_sections.append("TECHNICAL SKILLS")
            if project.languages and visibility.get("languages", True):
                expected_sections.append("LANGUAGES")
            if project.certifications and visibility.get("certifications", True):
                expected_sections.append("CERTIFICATIONS")

            upper_text = extracted_text.upper()
            found_sections = [
                section
                for section in expected_sections
                if section in upper_text
            ]

            section_positions = [
                upper_text.find(section)
                for section in found_sections
            ]

            order_is_monotonic = section_positions == sorted(
                section_positions
            )

            return {
                "passed": (
                    selectable_text
                    and name_found
                    and order_is_monotonic
                ),
                "selectable_text": selectable_text,
                "name_found": name_found,
                "characters_extracted": len(extracted_text),
                "page_count": page_count,
                "expected_sections": expected_sections,
                "found_sections": found_sections,
                "section_order_valid": order_is_monotonic,
                "text_sample": extracted_text[:1000],
                "block_count": sum(
                    len(items)
                    for items in blocks_by_page
                ),
            }

        except Exception as exc:
            return {
                "passed": False,
                "selectable_text": False,
                "name_found": False,
                "characters_extracted": 0,
                "page_count": 0,
                "expected_sections": [],
                "found_sections": [],
                "section_order_valid": False,
                "error": str(exc),
            }
