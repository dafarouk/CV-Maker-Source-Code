from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.cv_engine import CVEngine
from src.models import create_demo_project

TECTONIC = ROOT / "runtime" / "tectonic" / "tectonic.exe"
CACHE = ROOT / "runtime" / "tectonic" / "cache"
WORK_ROOT = ROOT / "build" / "tectonic_prime_generated"

# v33 is the same bundle generation used by CVM's prepared cache.
ONLINE_BUNDLES = (
    "https://relay.fullyjustified.net/default_bundle_v33.tar",
    "https://data1.fullyjustified.net/tlextras-2022.0r0.tar",
)
OFFLINE_BUNDLE_ID = "http://127.0.0.1:8765/default_bundle_v33.tar"

TEMPLATE_IDS = (
    "ats_classic",
    "ats_modern",
    "ats_compact",
    "executive",
)


def hidden_creation_flags() -> int:
    return getattr(subprocess, "CREATE_NO_WINDOW", 0)


def cache_stats() -> tuple[int, int]:
    if not CACHE.exists():
        return 0, 0
    files = [p for p in CACHE.rglob("*") if p.is_file()]
    return len(files), sum(p.stat().st_size for p in files)


def run(command: list[str], cwd: Path, env: dict[str, str]) -> tuple[bool, str]:
    result = subprocess.run(
        command,
        cwd=cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=180,
        creationflags=hidden_creation_flags(),
    )
    return result.returncode == 0, result.stdout


def render_sources() -> list[Path]:
    engine = CVEngine()
    sources: list[Path] = []

    if WORK_ROOT.exists():
        shutil.rmtree(WORK_ROOT)
    WORK_ROOT.mkdir(parents=True, exist_ok=True)

    for template_id in TEMPLATE_IDS:
        project = create_demo_project()
        project.design.template_id = template_id

        folder = WORK_ROOT / template_id
        folder.mkdir(parents=True, exist_ok=True)

        tex_path = folder / "cv.tex"
        tex_path.write_text(
            engine.render_latex(project, compact_level=0),
            encoding="utf-8",
        )
        sources.append(tex_path)

    return sources


def prime_one(tex_path: Path, env: dict[str, str]) -> None:
    last_output = ""

    for bundle_url in ONLINE_BUNDLES:
        command = [
            str(TECTONIC),
            "--bundle",
            bundle_url,
            "--keep-logs",
            "--outdir",
            str(tex_path.parent),
            tex_path.name,
        ]

        print(f"  online prime: {tex_path.parent.name} via {bundle_url}")
        ok, output = run(command, tex_path.parent, env)
        last_output = output

        if ok and (tex_path.parent / "cv.pdf").exists():
            return

    raise RuntimeError(
        f"Online cache prime failed for {tex_path.parent.name}.\n\n"
        + last_output[-5000:]
    )


def verify_one_offline(tex_path: Path, env: dict[str, str]) -> None:
    pdf_path = tex_path.parent / "cv.pdf"
    pdf_path.unlink(missing_ok=True)

    command = [
        str(TECTONIC),
        "--bundle",
        OFFLINE_BUNDLE_ID,
        "--only-cached",
        "--keep-logs",
        "--outdir",
        str(tex_path.parent),
        tex_path.name,
    ]

    print(f"  offline verify: {tex_path.parent.name}")
    ok, output = run(command, tex_path.parent, env)

    if not ok or not pdf_path.exists():
        raise RuntimeError(
            f"Offline verification failed for {tex_path.parent.name}.\n\n"
            + output[-5000:]
        )


def main() -> int:
    if not TECTONIC.exists():
        print(f"ERROR: bundled Tectonic not found: {TECTONIC}")
        return 1

    CACHE.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env["TECTONIC_CACHE_DIR"] = str(CACHE)

    before_files, before_bytes = cache_stats()
    print(
        f"CVM Tectonic cache before: "
        f"{before_files} files / {before_bytes / 1024 / 1024:.2f} MB"
    )

    tex_files = render_sources()

    print("\nPriming the cache from the pinned Tectonic v33 online bundle...")
    try:
        for tex_path in tex_files:
            prime_one(tex_path, env)
    except Exception as exc:
        print("\nCACHE PRIME FAILED")
        print(exc)
        return 2

    after_prime_files, after_prime_bytes = cache_stats()
    print(
        f"\nCVM Tectonic cache after prime: "
        f"{after_prime_files} files / {after_prime_bytes / 1024 / 1024:.2f} MB"
    )

    print("\nDisconnect-style verification with --only-cached...")
    try:
        for tex_path in tex_files:
            verify_one_offline(tex_path, env)
    except Exception as exc:
        print("\nOFFLINE VERIFY FAILED")
        print(exc)
        return 3

    print("\nSUCCESS: all generated CV templates compile from CVM's local cache only.")
    print("The cache is ready to bundle into the Windows release.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
