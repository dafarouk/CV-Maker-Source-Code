from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.config import APP_VERSION
from src.latex_workspace import LatexWorkspace


def test_version() -> None:
    assert APP_VERSION == "1.0.0"


def test_patch_layers_are_consolidated() -> None:
    index = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")

    for old_css in ("v073.css", "v074.css", "v075.css"):
        assert old_css not in index
        assert not (ROOT / "ui" / "css" / old_css).exists()

    for old_js in (
        "features_v073.js",
        "features_v074.js",
        "features_v075.js",
    ):
        assert old_js not in index
        assert not (ROOT / "ui" / "js" / old_js).exists()

    assert 'css/product_polish.css' in index
    assert 'js/product_ui.js' in index
    assert index.index('js/performance_v072.js') < index.index('js/product_ui.js')


def test_template_gallery_is_single_and_non_recursive() -> None:
    js = (ROOT / "ui" / "js" / "product_ui.js").read_text(encoding="utf-8")
    css = (ROOT / "ui" / "css" / "product_polish.css").read_text(encoding="utf-8")

    assert "cvmProductOpenGallery" in js
    assert "cvmProductUseSelectedTemplate" in js
    assert "cvmProductConfirmTemplateReplace" in js
    assert "window.confirm" not in js
    assert "MutationObserver" not in js
    assert "#cvmLatexStarterBtn" in js
    assert ".cvm-product-template-body" in css
    assert ".cvm-product-use-template" in css


def test_native_append_order_is_preserved() -> None:
    app = (ROOT / "ui" / "js" / "app.js").read_text(encoding="utf-8")
    product = (ROOT / "ui" / "js" / "product_ui.js").read_text(encoding="utf-8")

    assert "state.project[\n        collection\n    ].push(" in app
    assert "addCollectionItem =" not in product
    assert "unshift(" not in product


def test_gold_scrollbars_and_legacy_color_cleanup_layer() -> None:
    css = (ROOT / "ui" / "css" / "product_polish.css").read_text(encoding="utf-8")

    assert "scrollbar-color" in css
    assert "#D0AA70" in css
    assert "#BC965D" in css
    assert "*::-webkit-scrollbar-thumb" in css
    assert "cvm-picker-popover" in css
    assert "cvmV06AboutModal" in css


def test_ats_reset_and_large_result_ui() -> None:
    js = (ROOT / "ui" / "js" / "product_ui.js").read_text(encoding="utf-8")
    css = (ROOT / "ui" / "css" / "product_polish.css").read_text(encoding="utf-8")

    assert "cvmProductResetAts" in js
    assert "cvmProductRunAts" in js
    assert "How CVM checked your CV" in js
    assert ".cvm-product-ats-summary" in css
    assert ".cvm-product-method-grid" in css


def test_job_match_product_surface_is_removed() -> None:
    index = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")
    bridge = (ROOT / "src" / "bridge.py").read_text(encoding="utf-8")

    assert 'data-page="job"' not in index
    assert 'id="page-job"' not in index
    assert "analyze_job_match" not in bridge
    assert not (ROOT / "src" / "job_matcher.py").exists()


def test_template_catalog_is_complete() -> None:
    workspace = LatexWorkspace()
    ids = {item["id"] for item in workspace.templates()}

    assert {
        "classic_ats",
        "modern_gold",
        "navy_executive",
        "two_column",
        "photo_profile",
        "qr_contact",
    }.issubset(ids)


def main() -> None:
    checks = (
        test_version,
        test_patch_layers_are_consolidated,
        test_template_gallery_is_single_and_non_recursive,
        test_native_append_order_is_preserved,
        test_gold_scrollbars_and_legacy_color_cleanup_layer,
        test_ats_reset_and_large_result_ui,
        test_job_match_product_surface_is_removed,
        test_template_catalog_is_complete,
    )

    for check in checks:
        check()
        print(f"PASS {check.__name__}")

    print()
    print(f"CVM {APP_VERSION} FINAL CLEANUP TESTS OK")


if __name__ == "__main__":
    main()
