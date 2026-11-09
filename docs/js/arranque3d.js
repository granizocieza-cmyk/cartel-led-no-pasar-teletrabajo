/* =============================================================================
 *  arranque3d.js — Carga la escena 3D y, si algo falla, lleva a la versión ligera
 * =============================================================================
 *  Casos que mandan a ligero.html (la simulación 2D de siempre):
 *    - el navegador no tiene WebGL,
 *    - three.js no se puede descargar del CDN (sin conexión, bloqueado...),
 *    - la escena lanza un error al arrancar,
 *    - o tarda más de 15 s en estar lista.
 * ========================================================================== */
const aviso = document.getElementById('cargando');

function irALigero(motivo) {
  console.warn('[3D] ' + motivo + ' → versión ligera');
  if (aviso) {
    aviso.classList.remove('oculto');
    aviso.innerHTML = 'No se pudo cargar el 3D (' + motivo + ').<br>Abriendo la <a href="ligero.html">versión ligera</a>…';
  }
  setTimeout(() => location.replace('ligero.html'), 2200);
}

function hayWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

if (!hayWebGL()) {
  irALigero('WebGL no disponible');
} else {
  const temporizador = setTimeout(() => { if (!window.__3dListo) irALigero('tarda demasiado'); }, 15000);
  import('./escena3d.js').then(() => clearTimeout(temporizador)).catch((e) => {
    clearTimeout(temporizador);
    irALigero('error al iniciar: ' + (e && e.message ? e.message : e));
  });
}
