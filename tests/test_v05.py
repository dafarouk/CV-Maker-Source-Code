from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.config import APP_VERSION
from src.models import CVProject, create_demo_project
from src.v05_features import (
    V05Services,
    bullet_quality_report,
    completeness_report,
    optimizer_report,
)
from src.pdf_exporter import PDFExporter


def main() -> None:
    project = create_demo_project()

    # Backward compatible independent language fields.
    data = project.to_dict()
    data["design"].pop("ui_language", None)
    data["design"].pop("cv_language", None)
    restored = CVProject.from_dict(data)
    assert restored.design.ui_language in {"en", "fr"}
    assert restored.design.cv_language in {"en", "fr"}

    restored.design.ui_language = "fr"
    restored.design.cv_language = "en"
    restored.design.section_titles["experiences"] = "WORK EXPERIENCE"
    round_trip = CVProject.from_dict(restored.to_dict())
    assert round_trip.design.ui_language == "fr"
    assert round_trip.design.cv_language == "en"
    assert round_trip.design.section_titles["experiences"] == "WORK EXPERIENCE"

    completion = completeness_report(round_trip)
    assert 0 <= completion["score"] <= 100
    assert isinstance(completion["missing"], list)

    optimizer = optimizer_report(round_trip)
    assert "suggestions" in optimizer

    bullet_report = bullet_quality_report(round_trip)
    assert "bullets" in bullet_report


    service = V05Services()
    assert len(service.template_catalog()) >= 4
    assert "france" in service.country_presets()
    assert service.about()["version"] == APP_VERSION

    pdf = PDFExporter()
    capability = pdf.capability()
    assert "available" in capability

    print(f"CVM {APP_VERSION} PRODUCTIVITY TEST OK")
    print(f"Completeness: {completion['score']}%")
    print("PDF engine:", capability.get("engine") or "not detected")


if __name__ == "__main__":
    main()
