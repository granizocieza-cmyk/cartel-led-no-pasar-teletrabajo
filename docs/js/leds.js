/* =============================================================================
 *  leds.js — Dibuja un fotograma de la matriz 32x8 en un canvas 2D
 * =============================================================================
 *  Misma técnica que la simulación 2D (app.js): carcasa oscura de cada LED +
 *  halo difuso + núcleo brillante. Se usa en dos sitios: como textura del cartel
 *  dentro de la escena 3D y en la "lupa" del panel de telemetría.
 *  Devuelve un resumen de la luz emitida (para teñir el entorno con el mismo color).
 * ========================================================================== */
export function pintarLeds(ctx, W, H, marco, brillo, N) {
  const celda = W / N.ANCHO;
  // El brillo real (0..48 de 255) es muy bajo para una pantalla: lo reescalo solo
  // para DIBUJAR, manteniendo que el deslizador/limitador se note.
  const ganancia = 0.45 + 0.55 * (brillo / N.BRILLO_MAX);

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < N.ALTO; y++) {
    for (let x = 0; x < N.ANCHO; x++) {
      const px = x * celda, py = y * celda;
      ctx.fillStyle = '#0c0d14';
      ctx.fillRect(px + celda * 0.07, py + celda * 0.07, celda * 0.86, celda * 0.86);
      ctx.fillStyle = '#161824';
      ctx.beginPath(); ctx.arc(px + celda / 2, py + celda / 2, celda * 0.27, 0, 6.2832); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'lighter';
  let sr = 0, sg = 0, sb = 0, sInt = 0;
  for (let y = 0; y < N.ALTO; y++) {
    for (let x = 0; x < N.ANCHO; x++) {
      const i = (y * N.ANCHO + x) * 3;
      if (marco[i] + marco[i + 1] + marco[i + 2] === 0) continue;
      const r = Math.min(255, 255 * Math.pow(marco[i] / 255, 0.72) * ganancia);
      const g = Math.min(255, 255 * Math.pow(marco[i + 1] / 255, 0.72) * ganancia);
      const b = Math.min(255, 255 * Math.pow(marco[i + 2] / 255, 0.72) * ganancia);
      const inten = Math.max(r, g, b) / 255;
      sr += r; sg += g; sb += b; sInt += inten;
      const cx = x * celda + celda / 2, cy = y * celda + celda / 2;
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, celda * 1.3);
      halo.addColorStop(0, `rgba(${r | 0},${g | 0},${b | 0},${0.5 * inten})`);
      halo.addColorStop(1, `rgba(${r | 0},${g | 0},${b | 0},0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(cx - celda * 1.4, cy - celda * 1.4, celda * 2.8, celda * 2.8);
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.beginPath(); ctx.arc(cx, cy, celda * 0.31, 0, 6.2832); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.35 * inten})`;
      ctx.beginPath(); ctx.arc(cx, cy, celda * 0.13, 0, 6.2832); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  return { sr, sg, sb, sInt };
}
