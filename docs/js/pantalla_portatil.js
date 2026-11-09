/* =============================================================================
 *  pantalla_portatil.js — Lo que se ve en la pantalla del portátil (canvas 2D)
 * =============================================================================
 *  Interfaz de videollamada GENÉRICA (sin logos ni marcas): avatar, botones
 *  aceptar/rechazar, icono de micro, ondas de audio. Cuatro modos:
 *    trabajo -> un documento cualquiera
 *    suena   -> llamada entrante (con un cursor que pulsa "aceptar")
 *    llamada -> videollamada en curso, micro activo, ondas de audio
 *    fin     -> "llamada finalizada"
 * ========================================================================== */
const W = 512, H = 320;
const ROJO = '#ff3b3b', VERDE = '#2fe370';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function iconoMicro(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round';
  rr(ctx, cx - s * 0.2, cy - s * 0.5, s * 0.4, s * 0.62, s * 0.2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy + s * 0.02, s * 0.36, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.38); ctx.lineTo(cx, cy + s * 0.52); ctx.stroke();
  ctx.restore();
}

function iconoTelefono(ctx, cx, cy, s, color, colgar) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(colgar ? 2.35 : -0.78);
  ctx.strokeStyle = color; ctx.lineWidth = s * 0.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, s * 0.1, s * 0.34, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(-s * 0.44, s * 0.05, s * 0.16, s * 0.2);
  ctx.fillRect(s * 0.28, s * 0.05, s * 0.16, s * 0.2);
  ctx.restore();
}

function avatar(ctx, cx, cy, r, texto, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill();
  ctx.fillStyle = '#e8ecf5'; ctx.font = `600 ${r * 0.8}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(texto, cx, cy + r * 0.04);
}

function barraTareas(ctx, micActivo) {
  ctx.fillStyle = '#0a0c11'; ctx.fillRect(0, H - 22, W, 22);
  ctx.fillStyle = '#1c212c'; for (let i = 0; i < 4; i++) { rr(ctx, 12 + i * 26, H - 17, 18, 12, 3); ctx.fill(); }
  iconoMicro(ctx, W - 56, H - 11, 14, micActivo ? ROJO : '#4b5568');
  ctx.fillStyle = '#7d889f'; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText('09:41', W - 10, H - 11);
}

function modoTrabajo(ctx, t) {
  ctx.fillStyle = '#12151c'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#171b25'; ctx.fillRect(0, 0, 110, H - 22);
  ctx.fillStyle = '#242a38';
  for (let i = 0; i < 6; i++) { rr(ctx, 14, 40 + i * 28, 80 - (i % 3) * 14, 10, 4); ctx.fill(); }
  ctx.fillStyle = '#1c212c'; ctx.fillRect(110, 0, W - 110, 28);
  ctx.fillStyle = '#9aa6bd'; ctx.font = '600 12px Inter, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('informe_semanal.md', 126, 14);
  const lineas = [0.62, 0.9, 0.78, 0.5, 0.85, 0.7, 0.4, 0.88, 0.66, 0.3];
  lineas.forEach((l, i) => {
    ctx.fillStyle = i % 4 === 0 ? '#5b6b8f' : '#2b3345';
    rr(ctx, 130, 48 + i * 22, (W - 170) * l, 9, 4); ctx.fill();
  });
  if (Math.floor(t * 1.6) % 2 === 0) { ctx.fillStyle = '#c9d4ee'; ctx.fillRect(130 + (W - 170) * 0.3 + 6, 48 + 9 * 22 - 2, 2, 13); }
  barraTareas(ctx, false);
}

function modoSuena(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#171d2e'); g.addColorStop(1, '#0c0f18');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // anillos que se expanden alrededor del avatar
  for (let i = 0; i < 3; i++) {
    const f = ((t * 0.9 + i / 3) % 1);
    ctx.strokeStyle = `rgba(47,227,112,${0.35 * (1 - f)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, 112, 44 + f * 52, 0, 6.2832); ctx.stroke();
  }
  avatar(ctx, W / 2, 112, 42, 'CL', '#2a3550');
  ctx.fillStyle = '#e8ecf5'; ctx.font = '600 22px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Cliente S.L.', W / 2, 202);
  ctx.fillStyle = '#8c98b2'; ctx.font = '14px Inter, system-ui, sans-serif';
  ctx.fillText('Llamada entrante…', W / 2, 224);

  const rechazar = [W / 2 - 78, 268], aceptar = [W / 2 + 78, 268];
  ctx.fillStyle = ROJO; ctx.beginPath(); ctx.arc(rechazar[0], rechazar[1], 24, 0, 6.2832); ctx.fill();
  iconoTelefono(ctx, rechazar[0], rechazar[1], 26, '#fff', true);
  const pulso = 1 + 0.06 * Math.sin(t * 8);
  ctx.fillStyle = VERDE; ctx.beginPath(); ctx.arc(aceptar[0], aceptar[1], 24 * pulso, 0, 6.2832); ctx.fill();
  iconoTelefono(ctx, aceptar[0], aceptar[1], 26, '#06210f', false);

  // cursor: va hacia "aceptar" y hace clic
  const f = Math.min(1, Math.max(0, (t - 1.3) / 1.2));
  const e = f * f * (3 - 2 * f);
  const cx = W / 2 + 40 + (aceptar[0] - (W / 2 + 40)) * e, cy = 150 + (aceptar[1] - 150) * e;
  if (t > 2.65 && t < 3.0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(aceptar[0], aceptar[1], 26 + (t - 2.65) * 80, 0, 6.2832); ctx.stroke();
  }
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + 20); ctx.lineTo(cx + 5, cy + 15); ctx.lineTo(cx + 9, cy + 23);
  ctx.lineTo(cx + 12, cy + 21); ctx.lineTo(cx + 8, cy + 14); ctx.lineTo(cx + 15, cy + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  barraTareas(ctx, false);
}

function mmss(s) { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

function modoLlamada(ctx, t) {
  ctx.fillStyle = '#0b0d13'; ctx.fillRect(0, 0, W, H);
  // vídeo remoto (silueta genérica)
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#1b2236'); g.addColorStop(1, '#10131d');
  ctx.fillStyle = g; rr(ctx, 12, 12, W - 24, H - 74, 14); ctx.fill();
  ctx.fillStyle = '#2a3550';
  ctx.beginPath(); ctx.arc(W / 2, 108, 34, 0, 6.2832); ctx.fill();
  ctx.beginPath(); ctx.ellipse(W / 2, 196, 70, 52, 0, Math.PI, 0); ctx.fill();
  // ondas de audio de quien habla (remoto) en el borde inferior del vídeo
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a = 0.25 + 0.75 * Math.abs(Math.sin(t * 5 + i * 0.7) * Math.sin(t * 2.3 + i * 0.31));
    const h = 6 + 28 * a;
    ctx.fillStyle = `rgba(47,227,112,${0.35 + 0.5 * a})`;
    rr(ctx, 118 + i * 10, 214 - h / 2 + 22, 5, h, 2.5); ctx.fill();
  }
  // etiqueta con nombre + micro
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(ctx, 24, 24, 128, 24, 12); ctx.fill();
  ctx.fillStyle = '#e8ecf5'; ctx.font = '600 12px Inter, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('Cliente S.L.', 36, 36);
  // autovista
  ctx.fillStyle = '#222a3d'; rr(ctx, W - 118, 24, 90, 64, 10); ctx.fill();
  ctx.fillStyle = '#394563'; ctx.beginPath(); ctx.arc(W - 73, 50, 11, 0, 6.2832); ctx.fill();
  ctx.beginPath(); ctx.ellipse(W - 73, 82, 20, 14, 0, Math.PI, 0); ctx.fill();
  // cronómetro + "micro activo"
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(ctx, 24, H - 100, 150, 26, 13); ctx.fill();
  ctx.fillStyle = ROJO; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6); ctx.beginPath(); ctx.arc(40, H - 87, 5, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = '#e8ecf5'; ctx.font = '600 12px ui-monospace, monospace'; ctx.fillText(mmss(t) + '  MICRO ACTIVO', 52, H - 87);
  // barra de controles
  ctx.fillStyle = '#10131c'; ctx.fillRect(0, H - 56, W, 56);
  const botones = [[W / 2 - 90, '#262d3f', 'mic'], [W / 2 - 30, '#262d3f', 'cam'], [W / 2 + 30, '#262d3f', 'pan'], [W / 2 + 90, ROJO, 'colgar']];
  for (const [x, c, tipo] of botones) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, H - 28, 19, 0, 6.2832); ctx.fill();
    if (tipo === 'mic') {
      const p = (t * 1.4) % 1;
      ctx.strokeStyle = `rgba(47,227,112,${0.6 * (1 - p)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, H - 28, 19 + p * 10, 0, 6.2832); ctx.stroke();
      iconoMicro(ctx, x, H - 28, 22, VERDE);
    } else if (tipo === 'colgar') iconoTelefono(ctx, x, H - 28, 22, '#fff', true);
    else { ctx.strokeStyle = '#8c98b2'; ctx.lineWidth = 2; rr(ctx, x - 8, H - 34, 16, 12, 3); ctx.stroke(); }
  }
}

function modoFin(ctx, t, dur) {
  ctx.fillStyle = '#0d1018'; ctx.fillRect(0, 0, W, H);
  avatar(ctx, W / 2, 112, 38, 'CL', '#222a3d');
  ctx.fillStyle = '#e8ecf5'; ctx.font = '600 20px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Llamada finalizada', W / 2, 200);
  ctx.fillStyle = '#8c98b2'; ctx.font = '14px ui-monospace, monospace';
  ctx.fillText('Duración ' + mmss(dur), W / 2, 224);
  barraTareas(ctx, false);
}

export function crearPantalla(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  return {
    canvas, textura,
    /** modo: 'trabajo' | 'suena' | 'llamada' | 'fin'; t: segundos en ese modo; dur: duración de la última llamada */
    dibujar(modo, t, dur) {
      if (modo === 'suena') modoSuena(ctx, t);
      else if (modo === 'llamada') modoLlamada(ctx, t);
      else if (modo === 'fin') modoFin(ctx, t, dur || 0);
      else modoTrabajo(ctx, t);
      textura.needsUpdate = true;
    },
  };
}
