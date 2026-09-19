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

Write-Host "Refreshing CVM application icon..." -ForegroundColor DarkCyan
& $Python -c "from PIL import Image, ImageOps; from pathlib import Path; src=Path(r'assets/branding/cvm.png'); dst=Path(r'assets/branding/cvm_app.ico'); im=Image.open(src).convert('RGBA'); side=max(im.size); sq=Image.new('RGBA',(side,side),(0,0,0,0)); sq.alpha_composite(im,((side-im.width)//2,(side-im.height)//2)); sq=ImageOps.contain(sq,(256,256),Image.Resampling.LANCZOS); sq.save(dst,format='ICO',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])"
if ($LASTEXITCODE -ne 0) {
    throw "Unable to generate assets\branding\cvm_app.ico."
}

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
