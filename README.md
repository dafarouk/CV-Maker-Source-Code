# CV Maker (CVM) 1.0.0

Free, local-first Windows CV builder by Farouk.

CV Maker 1.0.0 is the first public Windows release. It includes `.cvm` projects, a self-contained offline PDF engine, a branded installer and GitHub-ready release files.

## Native CV Maker project files

New projects are saved as:

```text
My CV.cvm
```

Older `.cvproject` files remain readable. Saving an older project migrates it to `.cvm`.

The Windows installer can associate `.cvm` with CV Maker so a project opens by double-clicking it.

## PDF export

Public Windows builds use a bundled Tectonic engine plus a local TeX support bundle. End users do not need to install Python, MiKTeX, TeX Live or Tectonic separately.

The developer build script downloads the runtime once into:

```text
runtime/tectonic/
```

These large generated runtime files are intentionally not committed to Git.

## Development

```powershell
python -m src.main
```

## Tests

```powershell
python -m compileall -q src tests
python -m pytest -q tests
python .\tests\test_v076.py
python .\tests\test_release.py
python .\tests\smoke_test.py
```

## Build the Windows application

One-time developer setup:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Build the app folder:

```powershell
.\build\build_windows.ps1
```

## Build the branded installer + GitHub package

Install Inno Setup 6 once on the developer PC. It is only needed to create the installer, not by CV Maker users.

Then run:

```powershell
.\build\release_windows.ps1
```

The command creates:

```text
release/
├── CV-Maker-Setup-1.0.0.exe
├── CV-Maker-v1.0.0-Windows-x64.zip
└── SHA256.txt
```

Version `1.0.0` is the first public release, promoted after the 0.7.6 Windows installer and installed-app workflow were successfully validated.


## Updates

Public builds use GitHub Releases for updates. The configured repository is:

```text
https://github.com/dafarouk/CV-Maker
```

CV Maker checks automatically at startup at most once every 24 hours. The existing **About -> Check updates** button always performs a fresh manual check.

When a newer release contains `CV-Maker-Setup-X.Y.Z.exe` plus a verifiable SHA-256 digest/checksum, CV Maker can download it, verify it, close itself, install the update silently, and reopen the new version. User projects and settings are stored outside the installation directory and are preserved.

For each GitHub Release upload these three generated files:

```text
CV-Maker-Setup-X.Y.Z.exe
CV-Maker-vX.Y.Z-Windows-x64.zip
SHA256.txt
```

## Branding

- `assets/branding/cvm.png`: light monogram for dark surfaces
- `assets/branding/cvm_dark.png`: dark monogram for light surfaces
- `assets/branding/cvm_bg.png`: splash/loading wallpaper
- `assets/setup/cvm_setup_wizard.bmp`: installer welcome/finish artwork
- `assets/setup/cvm_setup_small.bmp`: installer page logo

## Website

https://www.damergi.com
