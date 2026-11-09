#!/usr/bin/env python3
"""
Genera las imágenes de la escena 3D para el README (docs/img/escena3d.png y escena3d.gif).

Cómo: sirve docs/ en local, abre Chrome/Edge SIN cabeza con  ?captura=SEGUNDOS  (la página
avanza el guion automático hasta ese instante y se queda quieta) y hace una captura
por instante. Con las capturas monta un GIF tipo "secuencia" con rótulos.

  pip install pillow
  python pruebas/capturar_escena3d.py

Necesita Google Chrome o Microsoft Edge instalado (o CHROME=ruta/al/ejecutable).
"""
import functools
import http.server
import os
import shutil
import subprocess
import sys
import tempfile
import threading

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(RAIZ, "docs")

# (segundos de guion, cámara, rótulo)
SECUENCIA = [
    (5.0, "general", "1 · Mamá trabaja. Micro libre: el cartel dice PASAR"),
    (9.6, "escritorio", "2 · Entra una llamada: el portátil suena"),
    (15.0, "general", "3 · Acepta: micro activo → petición HTTP → cartel en rojo"),
    (22.0, "general", "4 · Llegan dos personas, leen NO PASAR y esperan"),
    (31.0, "cartel", "5 · El cartel de la puerta (8×32 WS2812B)"),
    (40.0, "general", "6 · Cuelga: antirrebote de 5 s antes de cambiar"),
    (45.0, "general", "7 · PASAR: el cartel se pone en verde"),
    (50.5, "general", "8 · La puerta se abre y entran"),
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
    nav = buscar_navegador()
    manejador = functools.partial(http.server.SimpleHTTPRequestHandler, directory=DOCS)
    manejador.log_message = lambda *a, **k: None
    servidor = http.server.ThreadingHTTPServer(("127.0.0.1", 0), manejador)
    puerto = servidor.server_address[1]
    threading.Thread(target=servidor.serve_forever, daemon=True).start()

    tmp = tempfile.mkdtemp()
    fotos = []
    for i, (t, cam, rotulo) in enumerate(SECUENCIA):
        ruta = os.path.join(tmp, f"f{i}.png")
        url = f"http://127.0.0.1:{puerto}/?captura={t}&cam={cam}"
        subprocess.run([nav, "--headless=new", f"--screenshot={ruta}", "--window-size=1280,720",
                        "--virtual-time-budget=25000", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
                        "--hide-scrollbars", url], capture_output=True, timeout=180)
        if not os.path.exists(ruta):
            sys.exit(f"Falló la captura {i} ({url})")
        fotos.append(Image.open(ruta).convert("RGB"))
        print("capturada", i + 1, "/", len(SECUENCIA), rotulo)
    servidor.shutdown()

    # Imagen fija: el momento en que la gente espera ante el cartel en rojo
    destino_png = os.path.join(DOCS, "img", "escena3d.png")
    os.makedirs(os.path.dirname(destino_png), exist_ok=True)
    fotos[3].save(destino_png, optimize=True)

    # GIF de secuencia con rótulo
    fuente = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 26) if os.path.exists(r"C:\Windows\Fonts\segoeuib.ttf") else ImageFont.load_default()
    cuadros = []
    for f, (_, _, rotulo) in zip(fotos, SECUENCIA):
        g = f.resize((960, 540), Image.LANCZOS)
        d = ImageDraw.Draw(g, "RGBA")
        d.rectangle([0, 540 - 52, 960, 540], fill=(13, 16, 20, 225))
        d.text((20, 540 - 42), rotulo, font=fuente, fill=(230, 233, 239))
        cuadros.append(g.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    destino_gif = os.path.join(DOCS, "img", "escena3d.gif")
    cuadros[0].save(destino_gif, save_all=True, append_images=cuadros[1:], duration=2200, loop=0, optimize=True)
    print(destino_png, os.path.getsize(destino_png) // 1024, "KB")
    print(destino_gif, os.path.getsize(destino_gif) // 1024, "KB")


if __name__ == "__main__":
    main()
