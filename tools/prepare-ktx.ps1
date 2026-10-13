$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$cacheDirectory = Join-Path $projectRoot '.cache'
$archive = Join-Path $cacheDirectory 'ktx-4.4.2.exe'
$destination = Join-Path $cacheDirectory 'ktx'
$expectedHash = '1F323B0FEC19794F5E6C0425A61D4B1DA396872A10BE862D105F4F4B2D2957FE'
$extractor = 'C:/Program Files/7-Zip/7z.exe'
if (-not (Test-Path -LiteralPath $extractor)) { throw '7-Zip is required to extract the portable tools without running the installer.' }
New-Item -ItemType Directory -Force -Path $cacheDirectory | Out-Null
if (-not (Test-Path -LiteralPath $archive)) {
    Invoke-WebRequest 'https://github.com/KhronosGroup/KTX-Software/releases/download/v4.4.2/KTX-Software-4.4.2-Windows-x64.exe' -OutFile $archive
}
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expectedHash) { throw 'KTX archive digest mismatch' }
& $extractor x $archive "-o$destination" -y
if ($LASTEXITCODE -ne 0) { throw 'KTX extraction failed' }
& (Join-Path $destination 'bin/toktx.exe') --version
