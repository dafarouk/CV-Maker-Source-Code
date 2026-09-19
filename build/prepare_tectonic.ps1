$ErrorActionPreference = "Stop"

$Root = (Resolve-Path "$PSScriptRoot\..").Path
$RuntimeDir = Join-Path $Root "runtime\tectonic"
$CacheDir = Join-Path $RuntimeDir "cache"
$TempDir = Join-Path $Root "build\.tectonic-download"

$TectonicVersion = "0.17.0"
$TectonicUrl = "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-x86_64-pc-windows-msvc.zip"
$TectonicZipSha256 = "f61ce51f0b0ade1015b7de7ef368541c5424e9756ecbd0d7af97d6d48030845f"

$TectonicExe = Join-Path $RuntimeDir "tectonic.exe"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

if (-not (Test-Path $TectonicExe)) {
    Write-Host "Downloading Tectonic $TectonicVersion..." -ForegroundColor Cyan

    $ZipPath = Join-Path $TempDir "tectonic.zip"
    Invoke-WebRequest -Uri $TectonicUrl -OutFile $ZipPath -UseBasicParsing

    $ActualHash = (Get-FileHash -Algorithm SHA256 $ZipPath).Hash.ToLowerInvariant()
    if ($ActualHash -ne $TectonicZipSha256) {
        throw "Tectonic ZIP checksum mismatch. Expected $TectonicZipSha256 but got $ActualHash."
    }

    $ExtractDir = Join-Path $TempDir "tectonic"
    Remove-Item -Recurse -Force $ExtractDir -ErrorAction SilentlyContinue
    Expand-Archive -Path $ZipPath -DestinationPath $ExtractDir -Force

    $DownloadedExe = Get-ChildItem -Path $ExtractDir -Filter "tectonic.exe" -Recurse | Select-Object -First 1
    if (-not $DownloadedExe) {
        throw "tectonic.exe was not found in the downloaded archive."
    }

    Copy-Item $DownloadedExe.FullName $TectonicExe -Force
}
else {
    Write-Host "Tectonic executable already present." -ForegroundColor DarkGray
}

if (-not (Test-Path $CacheDir)) {
    throw @"
Missing prepared Tectonic cache:
    $CacheDir

The CVM release must include the cache that was primed and tested offline.
Do not rebuild the old 2.88 GB TAR bundle into the installer.
"@
}

$CacheFiles = Get-ChildItem -Path $CacheDir -Recurse -File -ErrorAction SilentlyContinue
if (-not $CacheFiles -or $CacheFiles.Count -eq 0) {
    throw "The prepared Tectonic cache is empty: $CacheDir"
}

$CacheBytes = ($CacheFiles | Measure-Object Length -Sum).Sum
$CacheMB = $CacheBytes / 1MB

Write-Host ""
Write-Host "Offline Tectonic runtime is ready:" -ForegroundColor Green
Write-Host "  $TectonicExe"
Write-Host ("  Cache: {0:N2} MB ({1} files)" -f $CacheMB, $CacheFiles.Count)
Write-Host ""
Write-Host "The old runtime\tectonic\bundle folder is NOT required for the release." -ForegroundColor Green
