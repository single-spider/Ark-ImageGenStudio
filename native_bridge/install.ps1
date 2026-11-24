param(
    [Parameter(Mandatory=$true)][string]$BackendRoot,
    [string]$PythonExe = "python"
)
$ErrorActionPreference = "Stop"
$backend = (Resolve-Path $BackendRoot).Path
if ((Split-Path $backend -Leaf) -ne "v2" -or !(Test-Path (Join-Path $backend "backend\app.py")) -or !(Test-Path (Join-Path (Split-Path $backend -Parent) "image_library.py"))) {
    throw "Provide the existing working v2 directory next to image_library.py (not the GitHub frontend root)."
}
$python = (Get-Command $PythonExe -ErrorAction Stop).Source
& $python -c "import uvicorn, fastapi, watchdog, PIL, requests, websockets"
if ($LASTEXITCODE -ne 0) { throw "Use the Python interpreter or virtual environment from your working Ark backend." }
$dir = Join-Path $env:LOCALAPPDATA "ArkLocalBridge"
New-Item -ItemType Directory -Force $dir | Out-Null
Copy-Item (Join-Path $PSScriptRoot "host.py") (Join-Path $dir "host.py") -Force
$hostFile = Join-Path $dir "host.py"
$launcher = Join-Path $dir "launch.bat"
$log = Join-Path $dir "bridge.log"
foreach ($path in @($python,$backend,$hostFile,$log)) {
    if ($path -match '[%\r\n"]') { throw "Unsupported character in native host path." }
}
$bat = "@echo off`r`nsetlocal DisableDelayedExpansion`r`n`"$python`" -u `"$hostFile`" `"$backend`" %* 2>>`"$log`"`r`n"
[IO.File]::WriteAllText($launcher, $bat, [Text.Encoding]::ASCII)
$manifest = @{
  name = "ark_local_bridge"
  description = "Ark Studio local backend bridge"
  path = $launcher
  type = "stdio"
  allowed_extensions = @("ark-local-bridge@single-spider.github.io")
} | ConvertTo-Json -Depth 5
$manifestPath = Join-Path $dir "ark_local_bridge.json"
[IO.File]::WriteAllText($manifestPath,$manifest,(New-Object Text.UTF8Encoding($false)))
$key = "HKCU:\Software\Mozilla\NativeMessagingHosts\ark_local_bridge"
New-Item -Path $key -Force | Out-Null
Set-Item -Path $key -Value $manifestPath
Write-Host "Ark Local Bridge registered for this Windows user. Load extension/firefox/manifest.json in about:debugging."
Write-Host "Logs: $log"
