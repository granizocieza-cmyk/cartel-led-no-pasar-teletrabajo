<#
  compilar-zig.ps1 — Compila cartel-agent.exe SIN instalar Visual Studio.

  Usa "zig c++" (un compilador gratuito que incluye las cabeceras de MinGW) a
  través de pip. Es la vía más corta si no tienes ningún compilador instalado:

      py -m venv .venv
      .venv\Scripts\pip install ziglang
      powershell -ExecutionPolicy Bypass -File scripts\compilar-zig.ps1

  Resultado: build\cartel-agent.exe  (+ build\test_nucleo.exe)
#>
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

# Busca python con ziglang: primero el .venv del proyecto, si no el del sistema.
$python = if (Test-Path "$raiz\.venv\Scripts\python.exe") { "$raiz\.venv\Scripts\python.exe" } else { 'python' }

New-Item -ItemType Directory -Force -Path build | Out-Null

$comunes = @('-std=c++17', '-O2', '-Wall', '-Wextra', '-target', 'x86_64-windows-gnu')

Write-Host '== Pruebas de la lógica =='
& $python -m ziglang c++ @comunes -o build\test_nucleo.exe tests\test_nucleo.cpp src\estado.cpp src\config.cpp
if ($LASTEXITCODE -ne 0) { throw 'fallo al compilar las pruebas' }
& build\test_nucleo.exe
if ($LASTEXITCODE -ne 0) { throw 'las pruebas fallan' }

Write-Host '== Agente =='
& $python -m ziglang c++ @comunes -DUNICODE -D_UNICODE "-Wl,--subsystem,windows" `
    -o build\cartel-agent.exe `
    src\main.cpp src\mic_wasapi.cpp src\http_winhttp.cpp src\estado.cpp src\config.cpp `
    -lole32 -loleaut32 -luuid -lwinhttp -lshell32
if ($LASTEXITCODE -ne 0) { throw 'fallo al compilar el agente' }

Copy-Item config.example.ini build\config.example.ini -Force
Write-Host 'Listo: build\cartel-agent.exe'
