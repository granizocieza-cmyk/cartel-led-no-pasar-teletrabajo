#!/usr/bin/env python3
"""
Genera docs/img/cartel.gif (la animación del README) con la lógica real del cartel.

  pip install pillow
  python pruebas/generar_gif.py

Pasos: Node ejecuta docs/js/nucleo.js y vuelca los fotogramas (JSON); aquí se
pintan los LEDs con un halo (como en la web) y se monta el GIF.
"""
import json
import math
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANCHO, ALTO = 32, 8
CELDA = 14                      # píxeles por LED en el GIF
W, H_CARTEL, H_BANDA = ANCHO * CELDA, ALTO * CELDA, 50
BRILLO_MAX = 48


def fuente(tam):
    for ruta in (r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        if os.path.exists(ruta):
            return ImageFont.truetype(ruta, tam)
    return ImageFont.load_default()


def pintar_cartel(px, brillo):
    ganancia = 0.4 + 0.6 * (brillo / BRILLO_MAX)
    base = Image.new("RGB", (W, H_CARTEL), (4, 4, 10))
    d = ImageDraw.Draw(base)
    for y in range(ALTO):
        for x in range(ANCHO):
            x0, y0 = x * CELDA, y * CELDA
            d.rectangle([x0 + 1, y0 + 1, x0 + CELDA - 2, y0 + CELDA - 2], fill=(11, 12, 19))
            d.ellipse([x0 + CELDA * .23, y0 + CELDA * .23, x0 + CELDA * .77, y0 + CELDA * .77], fill=(20, 21, 31))
    luz = Image.new("RGB", (W, H_CARTEL), (0, 0, 0))
    nucleo = Image.new("RGB", (W, H_CARTEL), (0, 0, 0))
    dl, dn = ImageDraw.Draw(luz), ImageDraw.Draw(nucleo)
    for y in range(ALTO):
        for x in range(ANCHO):
            i = (y * ANCHO + x) * 3
            r, g, b = px[i], px[i + 1], px[i + 2]
            if r + g + b == 0:
                continue
            col = tuple(min(255, int(255 * math.pow(v / 255, 0.72) * ganancia)) for v in (r, g, b))
            cx, cy = x * CELDA + CELDA / 2, y * CELDA + CELDA / 2
            dl.ellipse([cx - CELDA * .75, cy - CELDA * .75, cx + CELDA * .75, cy + CELDA * .75], fill=tuple(int(c * .55) for c in col))
            dn.ellipse([cx - CELDA * .3, cy - CELDA * .3, cx + CELDA * .3, cy + CELDA * .3], fill=col)
    luz = luz.filter(ImageFilter.GaussianBlur(CELDA * .55))
    from PIL import ImageChops
    return ImageChops.add(ImageChops.add(base, luz), nucleo)


def main():
    crudo = subprocess.run(["node", os.path.join(RAIZ, "pruebas", "volcar_secuencia.js")],
                           capture_output=True, text=True, encoding="utf-8", check=True).stdout
    datos = json.loads(crudo)
    f_tit, f_pie = fuente(20), fuente(13)
    cuadros = []
    for c in datos["cuadros"]:
        lienzo = Image.new("RGB", (W, H_BANDA + H_CARTEL), (9, 12, 19))
        d = ImageDraw.Draw(lienzo)
        d.text((16, 9), c["rotulo"], font=f_tit, fill=(232, 236, 245))
        d.text((16, 34), "simulación · cartel NO PASAR · 32×8 WS2812B", font=f_pie, fill=(120, 132, 158))
        lienzo.paste(pintar_cartel(c["px"], c["brillo"]), (0, H_BANDA))
        cuadros.append(lienzo.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))

    destino = os.path.join(RAIZ, "docs", "img", "cartel.gif")
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    cuadros[0].save(destino, save_all=True, append_images=cuadros[1:], duration=int(1000 / datos["fps"]),
                    loop=0, optimize=True, disposal=1)
    print(f"{destino}  ({os.path.getsize(destino) / 1024:.0f} KB, {len(cuadros)} fotogramas)")


if __name__ == "__main__":
    sys.exit(main())
