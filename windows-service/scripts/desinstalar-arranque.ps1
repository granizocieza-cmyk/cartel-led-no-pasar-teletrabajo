<#
  desinstalar-arranque.ps1 — Detiene el agente y quita el arranque automático.
  Conserva config.ini y el registro por si lo vuelves a instalar; bórralos a mano
  (carpeta %LOCALAPPDATA%\cartel-agent) si no los quieres.
#>
$ErrorActionPreference = 'Stop'
$destino = Join-Path $env:LOCALAPPDATA 'cartel-agent'
$exe = Join-Path $destino 'cartel-agent.exe'

if (Test-Path $exe) { & $exe --parar | Out-Null; Start-Sleep -Seconds 2 }

$enlace = Join-Path ([Environment]::GetFolderPath('Startup')) 'Cartel NO PASAR (agente).lnk'
if (Test-Path $enlace) { Remove-Item $enlace -Force; Write-Host 'Arranque automático eliminado.' }
if (Test-Path $exe)    { Remove-Item $exe -Force;    Write-Host 'Programa eliminado.' }
Write-Host 'Hecho.'
