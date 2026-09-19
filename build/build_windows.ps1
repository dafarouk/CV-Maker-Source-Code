$ErrorActionPreference = "Stop"

$Root = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $Root

$ConfigText = Get-Content ".\src\config.py" -Raw
$VersionMatch = [regex]::Match($ConfigText, 'APP_VERSION\s*=\s*"([^"]+)"')
if (-not $VersionMatch.Success) {
    throw "Unable to read APP_VERSION from src\config.py"
}
$Version = $VersionMatch.Groups[1].Value

Write-Host "== CV Maker $Version Windows build ==" -ForegroundColor Cyan

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
    throw "Missing .venv. Create it first with: python -m venv .venv"
}

$Python = ".\.venv\Scripts\python.exe"

Write-Host "Validating bundled offline PDF engine..." -ForegroundColor DarkCyan
# prepare_tectonic.ps1 is a PowerShell script, not a native executable.
# Any real failure inside it throws and stops this build because
# $ErrorActionPreference is set to Stop. Do not inspect $LASTEXITCODE here:
# it can contain a stale exit code from an earlier native process.
& ".\build\prepare_tectonic.ps1"

Write-Host "Validating CVM application icon..." -ForegroundColor DarkCyan
$AppIcon = ".\assets\branding\cvm_app.ico"
if (-not (Test-Path $AppIcon)) {
    throw "Missing custom application icon: assets\branding\cvm_app.ico"
}
Write-Host "Using existing custom icon: $AppIcon" -ForegroundColor Green

Write-Host "Generating Windows version metadata..." -ForegroundColor DarkCyan
& $Python ".\build\generate_version_info.py"
if ($LASTEXITCODE -ne 0) {
    throw "Unable to generate build\version_info.txt."
}

Write-Host "Running release tests..." -ForegroundColor DarkCyan
& $Python -m pytest -q tests
if ($LASTEXITCODE -ne 0) {
    throw "CVM tests failed. Build cancelled."
}

Write-Host "Building CV Maker application folder..." -ForegroundColor DarkCyan
& $Python -m PyInstaller --noconfirm --clean ".\build\CV_Maker.spec"
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller build failed."
}

$Exe = ".\dist\CV Maker\CV Maker.exe"
if (-not (Test-Path $Exe)) {
    throw "Build completed but $Exe was not found."
}

Write-Host ""
Write-Host "CVM application build ready:" -ForegroundColor Green
Write-Host "  $Exe"
Write-Host ""
Write-Host "The public build includes the offline Tectonic PDF engine." -ForegroundColor Green
