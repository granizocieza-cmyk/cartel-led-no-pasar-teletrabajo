<#
  instalar-arranque.ps1 — Instala cartel-agent para que arranque solo al iniciar
  sesión, sin ventana y SIN permisos de administrador.

  Qué hace:
    1. Copia cartel-agent.exe y la configuración a  %LOCALAPPDATA%\cartel-agent\
    2. Crea config.ini a partir de config.example.ini (si no existía).
    3. Crea un acceso directo en la carpeta "Inicio" del usuario (shell:startup).
       POR QUÉ ahí y no con el Programador de tareas: es lo más sencillo, no pide
       administrador y se ve/quita desde Configuración > Aplicaciones > Inicio.
    4. Lo arranca ahora mismo.

  Uso (en PowerShell, desde la carpeta windows-service):
      powershell -ExecutionPolicy Bypass -File scripts\instalar-arranque.ps1
      powershell -ExecutionPolicy Bypass -File scripts\instalar-arranque.ps1 -Exe C:\ruta\cartel-agent.exe
#>
param(
  [string]$Exe = ''
)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot

# Busca el .exe: el indicado, o el compilado por compilar-zig.ps1 / CMake.
if (-not $Exe) {
  $candidatos = @("$raiz\build\cartel-agent.exe", "$raiz\build\Release\cartel-agent.exe", "$raiz\cartel-agent.exe")
  $Exe = $candidatos | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $Exe -or -not (Test-Path $Exe)) {
  throw 'No encuentro cartel-agent.exe. Compílalo primero (ver README) o pasa -Exe RUTA.'
}

$destino = Join-Path $env:LOCALAPPDATA 'cartel-agent'
New-Item -ItemType Directory -Force -Path $destino | Out-Null

# Si ya hay uno en marcha, lo paramos para poder sustituir el .exe.
$destinoExe = Join-Path $destino 'cartel-agent.exe'
if (Test-Path $destinoExe) {
  & $destinoExe --parar | Out-Null
  Start-Sleep -Seconds 2
}
Copy-Item $Exe $destinoExe -Force

$config = Join-Path $destino 'config.ini'
if (-not (Test-Path $config)) {
  Copy-Item "$raiz\config.example.ini" $config
  Write-Host "Creado $config  <-- edítalo con el Bloc de notas (host, token...)."
} else {
  Write-Host "Conservo tu config.ini existente."
}

# Acceso directo en Inicio (minimizado; el programa de todos modos no tiene ventana).
$inicio = [Environment]::GetFolderPath('Startup')
$enlace = Join-Path $inicio 'Cartel NO PASAR (agente).lnk'
$ws = New-Object -ComObject WScript.Shell
$a = $ws.CreateShortcut($enlace)
$a.TargetPath = $destinoExe
$a.WorkingDirectory = $destino
$a.WindowStyle = 7
$a.Description = 'Avisa al cartel LED cuando el micrófono está en uso'
$a.Save()

Start-Process -FilePath $destinoExe -WorkingDirectory $destino
Write-Host ''
Write-Host 'Instalado y en marcha.'
Write-Host "  Programa : $destinoExe"
Write-Host "  Config   : $config"
Write-Host "  Registro : $env:LOCALAPPDATA\cartel-agent\agente.log"
Write-Host "  Arranque : $enlace"
