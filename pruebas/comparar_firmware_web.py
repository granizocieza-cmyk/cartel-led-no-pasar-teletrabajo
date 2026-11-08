#!/usr/bin/env python3
"""
Comprueba que la simulación web dibuja EXACTAMENTE lo mismo que el firmware.

  1. Compila firmware-esp32/pruebas/volcar_frames.cpp (usa animaciones.h tal cual).
  2. Ejecuta pruebas/volcar_web.js (usa docs/js/nucleo.js).
  3. Compara las dos salidas línea a línea.

Necesita un compilador de C++ (g++, clang++ o "python -m ziglang c++") y Node.js.
Uso:   python pruebas/comparar_firmware_web.py
"""
import difflib
import os
import shutil
import subprocess
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def compilador():
    for c in ("g++", "clang++", "c++"):
        if shutil.which(c):
            return [c]
    try:
        import ziglang  # noqa: F401
        return [sys.executable, "-m", "ziglang", "c++"]
    except ImportError:
        sys.exit("No encuentro compilador de C++ (instala g++ o 'pip install ziglang').")


def main():
    with tempfile.TemporaryDirectory() as tmp:
        exe = os.path.join(tmp, "volcar_frames" + (".exe" if os.name == "nt" else ""))
        fuente = os.path.join(RAIZ, "firmware-esp32", "pruebas", "volcar_frames.cpp")
        incluir = os.path.join(RAIZ, "firmware-esp32", "cartel")
        subprocess.run(compilador() + ["-std=c++17", "-O1", "-I", incluir, fuente, "-o", exe], check=True)
        salida_cpp = subprocess.run([exe], capture_output=True, text=True, check=True).stdout

    salida_js = subprocess.run(
        ["node", os.path.join(RAIZ, "pruebas", "volcar_web.js")], capture_output=True, text=True, check=True
    ).stdout

    a, b = salida_cpp.splitlines(), salida_js.splitlines()
    if a == b:
        print(f"OK: firmware y simulación web coinciden en {sum(1 for l in a if l.startswith('=='))} fotogramas.")
        return 0
    print("DIFERENCIAS entre firmware (-) y web (+):")
    for linea in list(difflib.unified_diff(a, b, "firmware", "web", lineterm="", n=0))[:60]:
        print(linea)
    return 1


if __name__ == "__main__":
    sys.exit(main())
