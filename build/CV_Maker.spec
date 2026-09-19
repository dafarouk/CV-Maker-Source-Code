# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

ROOT = Path(SPECPATH).resolve().parent


datas = [
    (str(ROOT / "ui"), "ui"),
    (str(ROOT / "templates"), "templates"),
    (str(ROOT / "assets"), "assets"),
]

# Public Windows builds carry the complete offline Tectonic runtime.
tectonic = ROOT / "runtime" / "tectonic"
if tectonic.exists():
    datas.append(
        (
            str(tectonic),
            "runtime/tectonic",
        )
    )


a = Analysis(
    [str(ROOT / "src" / "main.py")],
    pathex=[str(ROOT)],
    binaries=[],
    datas=datas,
    hiddenimports=[
        "webview",
        "webview.platforms.edgechromium",
        "clr",
        "pythonnet",
        "pymupdf",
        "docx",
        "jinja2",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

# onedir build: CV Maker.exe stays small and the bundled LaTeX runtime is
# installed once instead of being extracted from a giant one-file EXE at
# every launch.
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="CV Maker",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    icon=str(ROOT / "assets" / "branding" / "cvm_app.ico"),
    version=str(ROOT / "build" / "version_info.txt"),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="CV Maker",
)
