from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "src" / "config.py"
OUTPUT = ROOT / "build" / "version_info.txt"

text = CONFIG.read_text(encoding="utf-8")
match = re.search(r'^APP_VERSION\s*=\s*"([^"]+)"', text, flags=re.MULTILINE)
if not match:
    raise SystemExit("APP_VERSION not found in src/config.py")

version = match.group(1)
parts = [int(part) for part in version.split(".")]
while len(parts) < 4:
    parts.append(0)
parts = parts[:4]

OUTPUT.write_text(
    f'''VSVersionInfo(\n  ffi=FixedFileInfo(\n    filevers=({parts[0]},{parts[1]},{parts[2]},{parts[3]}),\n    prodvers=({parts[0]},{parts[1]},{parts[2]},{parts[3]}),\n    mask=0x3f,\n    flags=0x0,\n    OS=0x40004,\n    fileType=0x1,\n    subtype=0x0,\n    date=(0,0)\n  ),\n  kids=[\n    StringFileInfo([\n      StringTable(\n        '040904B0',\n        [\n          StringStruct('CompanyName', 'Farouk'),\n          StringStruct('FileDescription', 'CV Maker - ATS-friendly CV builder'),\n          StringStruct('FileVersion', '{version}'),\n          StringStruct('InternalName', 'CVM'),\n          StringStruct('OriginalFilename', 'CV Maker.exe'),\n          StringStruct('ProductName', 'CV Maker'),\n          StringStruct('ProductVersion', '{version}'),\n        ]\n      )\n    ]),\n    VarFileInfo([VarStruct('Translation', [1033, 1200])])\n  ]\n)\n''',
    encoding="utf-8",
)

print(f"Generated version_info.txt for CV Maker {version}")
