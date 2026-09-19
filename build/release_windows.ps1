$ErrorActionPreference = "Stop"

$Root = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $Root

$ConfigText = Get-Content ".\src\config.py" -Raw
$VersionMatch = [regex]::Match($ConfigText, 'APP_VERSION\s*=\s*"([^"]+)"')
if (-not $VersionMatch.Success) {
    throw "Unable to read APP_VERSION from src\config.py"
}
$Version = $VersionMatch.Groups[1].Value

Write-Host "== CV Maker $Version release build ==" -ForegroundColor Cyan

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
    throw "Missing .venv. Create it once with: python -m venv .venv"
}

$Python = ".\.venv\Scripts\python.exe"

# Clean development-only generated files. Do not touch user projects.
Write-Host "Cleaning development caches..." -ForegroundColor DarkCyan
Get-ChildItem -Path "." -Directory -Recurse -Force -Filter "__pycache__" -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".\.pytest_cache" -ErrorAction SilentlyContinue
Remove-Item ".\data\settings\export_history.json" -Force -ErrorAction SilentlyContinue
Remove-Item ".\data\settings\recent_projects.json" -Force -ErrorAction SilentlyContinue

# Build the onedir application including the offline PDF runtime.
& powershell -ExecutionPolicy Bypass -File ".\build\build_windows.ps1"
if ($LASTEXITCODE -ne 0) {
    throw "Application build failed."
}

# Find Inno Setup compiler.
$ProgramFilesX86 = [Environment]::GetFolderPath("ProgramFilesX86")
$ProgramFiles64 = [Environment]::GetFolderPath("ProgramFiles")
$LocalPrograms = Join-Path $env:LOCALAPPDATA "Programs"

$InnoCandidates = @(
    (Join-Path $ProgramFilesX86 "Inno Setup 6\ISCC.exe"),
    (Join-Path $ProgramFiles64 "Inno Setup 6\ISCC.exe"),
    (Join-Path $LocalPrograms "Inno Setup 6\ISCC.exe")
)

$ISCC = $InnoCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $ISCC) {
    throw @"
Inno Setup 6 is required only on YOUR development PC to create Setup.exe.
Install it for free, then run this script again.
Quick option:
    winget install JRSoftware.InnoSetup
"@
}

# Build the installer outside the Desktop/project tree.
# On this Windows machine Inno Setup's resource update fails with error 110
# when Setup.exe is created under the project Desktop folder.
$InstallerBuildDir = Join-Path $env:LOCALAPPDATA "CVMInstallerBuild"
Remove-Item -Recurse -Force $InstallerBuildDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $InstallerBuildDir | Out-Null

Write-Host "Building branded Windows installer..." -ForegroundColor DarkCyan
& $ISCC "-o$InstallerBuildDir" "/DMyAppVersion=$Version" ".\build\CV_Maker.iss"
if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup build failed."
}

$Installer = Join-Path $InstallerBuildDir "CV-Maker-Setup-$Version.exe"
if (-not (Test-Path $Installer)) {
    throw "Installer was not created at $Installer"
}

$ReleaseDir = ".\release"
$PackageDir = Join-Path $ReleaseDir "CV-Maker-v$Version-Windows-x64"
$ZipPath = Join-Path $ReleaseDir "CV-Maker-v$Version-Windows-x64.zip"
$SetupCopy = Join-Path $ReleaseDir "CV-Maker-Setup-$Version.exe"
$HashFile = Join-Path $ReleaseDir "SHA256.txt"

Remove-Item -Recurse -Force $ReleaseDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $PackageDir | Out-Null

Copy-Item $Installer $SetupCopy -Force

# User-facing ZIP: keep it intentionally simple.
# After extraction the user sees exactly:
#   CV-Maker-Setup-X.Y.Z.exe
#   README.txt
Copy-Item $Installer (Join-Path $PackageDir "CV-Maker-Setup-$Version.exe") -Force
Copy-Item ".\build\README-FIRST.txt" (Join-Path $PackageDir "README.txt") -Force

Compress-Archive -Path "$PackageDir\*" -DestinationPath $ZipPath -CompressionLevel Optimal -Force

$SetupHash = (Get-FileHash -Algorithm SHA256 $SetupCopy).Hash.ToLowerInvariant()
$ZipHash = (Get-FileHash -Algorithm SHA256 $ZipPath).Hash.ToLowerInvariant()

@"
CV Maker $Version - SHA256

$SetupHash  CV-Maker-Setup-$Version.exe
$ZipHash  CV-Maker-v$Version-Windows-x64.zip
"@ | Set-Content -Path $HashFile -Encoding UTF8

Remove-Item -Recurse -Force $PackageDir

Write-Host ""
Write-Host "RELEASE READY" -ForegroundColor Green
Write-Host "  $SetupCopy"
Write-Host "  $ZipPath"
Write-Host "  $HashFile"
Write-Host ""
Write-Host "Normal users should download the ZIP. It extracts to Setup.exe + README.txt." -ForegroundColor Green
Write-Host "Upload the Setup EXE, ZIP and SHA256.txt to the GitHub Release page." -ForegroundColor Green
