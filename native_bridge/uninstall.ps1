$ErrorActionPreference = "Stop"
$key = "HKCU:\Software\Mozilla\NativeMessagingHosts\ark_local_bridge"
if (Test-Path $key) { Remove-Item $key -Force }
$dir = Join-Path $env:LOCALAPPDATA "ArkLocalBridge"
if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
Write-Host "Bridge removed. Your Ark backend, configuration, database and images are unchanged."
