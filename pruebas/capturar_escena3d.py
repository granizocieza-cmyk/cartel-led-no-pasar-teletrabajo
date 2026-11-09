#!/usr/bin/env python3
"""
Hace capturas de la escena 3D para revisarla (no genera nada que vaya al README).

Sirve docs/ en local y abre Chrome/Edge SIN cabeza con  ?captura=SEGUNDOS&cam=...  (la página
avanza el guion automático hasta ese instante y se queda quieta). Una captura por instante.

  python pruebas/capturar_escena3d.py                 # escritorio  -> capturas_escena3d/
  python pruebas/capturar_escena3d.py --movil         # 390x844
  python pruebas/capturar_escena3d.py --salida ruta   # otra carpeta

Necesita Google Chrome o Microsoft Edge (o la variable CHROME con la ruta del ejecutable).
"""
import argparse
import functools
import http.server
import os
import shutil
import subprocess
import sys
import threading

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(RAIZ, "docs")

# (nombre, segundos de guion, cámara). Tiempos del guion automático (ver tareaMama/tareaVisitantes):
#   ~8 s suena · ~11 s llamada · ~13 s cartel en rojo · ~16 s llegan visitantes · ~37.5 s cuelga
#   ~43 s cartel en verde · ~47 s abre la puerta · ~50 s entran
SECUENCIA = [
    ("01_trabaja", 5.0, "general"),
    ("02_bocadillo_suena", 9.7, "general"),
    ("03_bocadillo_en_llamada", 16.0, "general"),
    ("04_esperan", 22.0, "general"),
    ("05_cartel", 31.0, "cartel"),
    ("06_bocadillo_finalizada", 38.3, "general"),
    ("07_pasar", 45.0, "general"),
    ("08_entran", 49.5, "general"),
    ("09_escritorio", 16.0, "escritorio"),
]


def buscar_navegador():
    if os.environ.get("CHROME"):
        return os.environ["CHROME"]
    candidatos = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ]
    for c in candidatos:
        if os.path.exists(c):
            return c
    for n in ("google-chrome", "chromium", "chrome", "msedge"):
        if shutil.which(n):
            return shutil.which(n)
    sys.exit("No encuentro Chrome/Edge. Define la variable CHROME con su ruta.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--movil", action="store_true", help="tamaño de móvil (390x844)")
    ap.add_argument("--salida", default=os.path.join(RAIZ, "capturas_escena3d"))
    args = ap.parse_args()
    tam = "390,844" if args.movil else "1280,720"
    destino = os.path.join(args.salida, "movil" if args.movil else "escritorio")
    os.makedirs(destino, exist_ok=True)

    nav = buscar_navegador()
    manejador = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DOCS)
    manejador.log_message = lambda *a, **k: None
    servidor = http.server.ThreadingHTTPServer(("127.0.0.1", 0), manejador)
    puerto = servidor.server_address[1]
    threading.Thread(target=servidor.serve_forever, daemon=True).start()

    for nombre, t, cam in SECUENCIA:
        ruta = os.path.join(destino, nombre + ".png")
        url = f"http://127.0.0.1:{puerto}/?captura={t}&cam={cam}"
        subprocess.run([nav, "--headless=new", f"--screenshot={ruta}", f"--window-size={tam}",
                        "--virtual-time-budget=25000", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
                        "--hide-scrollbars", url], capture_output=True, timeout=180)
        print(("ok  " if os.path.exists(ruta) else "FALLO"), ruta)
    servidor.shutdown()


if __name__ == "__main__":
    main()
