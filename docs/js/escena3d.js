/* =============================================================================
 *  escena3d.js — La maqueta 3D: cámara, guion, telemetría y conexión con la lógica real
 * =============================================================================
 *  La lógica del proyecto NO se reinventa aquí: se reutiliza docs/js/nucleo.js
 *  (el mismo que la simulación 2D y que se compara píxel a píxel con el firmware):
 *     N.Agente  -> antirrebote y latido del PC
 *     N.Cartel  -> máquina de estados + animaciones del ESP32
 *  Esta escena solo los "pone en un decorado": la persona (guion) decide cuándo
 *  el micro está en uso, y el cartel de la puerta dibuja lo que Cartel produce.
 *
 *  Dos relojes (igual que la versión 2D):
 *    visual : milisegundos reales; anima el cartel y la transición.
 *    logico : puede ir x1 o x5 más rápido; cuenta el antirrebote, el latido y
 *             los 45 s de "sin señal".
 * ========================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Maniqui } from './maniqui.js';
import { crearHabitacion } from './habitacion.js';
import { pintarLeds } from './leds.js';

const N = window.Nucleo;
const $ = (id) => document.getElementById(id);
const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ Renderer
const canvas = $('c3d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
const controles = new OrbitControls(camara, canvas);
controles.enableDamping = !reducido;
controles.dampingFactor = 0.08;
controles.minDistance = 1.0;
controles.maxDistance = 12;
controles.minPolarAngle = 0.15;
controles.maxPolarAngle = 1.5;           // no deja bajar de la altura del suelo
controles.minAzimuthAngle = -0.6;        // no se puede ver "por detrás" de las paredes altas
controles.maxAzimuthAngle = 1.9;
controles.screenSpacePanning = true;

const hab = crearHabitacion();
escena.add(hab.grupo);
const D = hab.D;

// Las cámaras predefinidas
const CAMARAS = {
  general: { pos: [4.5, 3.7, 6.3], mira: [-0.6, 0.45, -0.1] },
  cartel: { pos: [1.5, 1.62, -0.4], mira: [0.0, 1.5, -0.1] },
  escritorio: { pos: [-0.55, 1.5, 0.35], mira: [-1.9, 0.85, -1.45] },
};
let tween = null;
function irACamara(nombre, instantaneo = false) {
  const c = CAMARAS[nombre]; if (!c) return;
  document.querySelectorAll('.cam').forEach((b) => b.classList.toggle('activo', b.dataset.cam === nombre));
  const p1 = new THREE.Vector3(...c.pos), t1 = new THREE.Vector3(...c.mira);
  // En pantallas verticales (móvil) la vista general se aleja para que quepa toda la maqueta.
  if (nombre === 'general' && camara.aspect < 0.9) p1.sub(t1).multiplyScalar(1.55).add(t1);
  if (instantaneo || reducido) { camara.position.copy(p1); controles.target.copy(t1); tween = null; controles.update(); return; }
  tween = { t: 0, dur: 1.3, p0: camara.position.clone(), t0: controles.target.clone(), p1, t1 };
}

// ---------------------------------------------------------------- Personajes
const mama = new Maniqui({ color: 0xdccaa9, acento: 0xb9a07a, cascos: true });
mama.root.position.set(D.silla.x, 0, D.silla.z);
mama.teletransportarYaw(Math.PI);
mama.poner('sentado'); mama.cur = { ...mama.tgt }; mama.capasObjetivo.teclear = 1; mama.capas.teclear = 1;
const v1 = new Maniqui({ color: 0xc9d0d8, acento: 0x9aa4b2 });
const v2 = new Maniqui({ color: 0xd9c4b6, acento: 0xb59b8a });
const visitantes = [v1, v2];
for (const v of visitantes) { v.root.visible = false; }
const personas = [mama, v1, v2];
personas.forEach((p) => { p.movimientoReducido = reducido; escena.add(p.root); });

// ------------------------------------------------------- Lógica real (nucleo.js)
const cartel = new N.Cartel('IP 192.168.1.50');
const agente = new N.Agente();
let visual = 0, logico = 0, proximoTick = 0, velocidad = 1;
const sim = { mic: false, wifi: true, auto: !reducido, llamar: false, colgar: false };
const mamaEst = { modo: 'trabajo', t: 0, dur: 0 };
let puertaF = 0, puertaObj = 0;
let dentro = false;                                  // ¿hay visitantes en el guion?
const paquetes = [];

function hora(ms) {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
function logHttp(texto, clase) {
  const ol = $('log-http'); if (!ol) return;
  const li = document.createElement('li');
  const t = document.createElement('span'); t.className = 't'; t.textContent = hora(logico) + ' ';
  const m = document.createElement('span'); if (clase) m.className = clase; m.textContent = texto;
  li.append(t, m); ol.appendChild(li);
  while (ol.children.length > 60) ol.removeChild(ol.firstChild);
  ol.scrollTop = ol.scrollHeight;
}

// El agente mira el micro cada segundo (lógico) y, si toca, envía una petición.
function pasoAgente(tl) {
  const a = agente.tick(tl, sim.mic);
  if (!a.enviar) return;
  const ruta = a.estado === N.OCUPADO ? '/ocupado' : '/libre';
  const ok = sim.wifi;
  agente.resultadoEnvio(ok, tl);
  paquetes.push({ inicio: visual, estado: a.estado, ruta, latido: a.esLatido, ok, entregado: false, malla: null });
  logHttp(`→ ${a.esLatido ? 'latido ' : ''}GET ${ruta}`, 'dim');
  anillosWifi();
}

// ------------------------------------------------- Paquete HTTP viajando por WiFi
const TIEMPO_VIAJE = 0.9;                              // s reales
const origenPaquete = new THREE.Vector3(D.escritorio.x, 1.0, D.escritorio.z);
const destino = new THREE.Vector3();
const medio = new THREE.Vector3();
const curva = new THREE.QuadraticBezierCurve3(origenPaquete.clone(), medio, destino);
const geoBola = new THREE.SphereGeometry(0.045, 14, 10);
const lineaGeo = new THREE.BufferGeometry().setFromPoints(curva.getPoints(28));
const linea = new THREE.Line(lineaGeo, new THREE.LineDashedMaterial({ color: 0x5b6b8f, dashSize: 0.05, gapSize: 0.07, transparent: true, opacity: 0.55 }));
escena.add(linea);

const anillos = [];
function anillosWifi() {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.115, 40),
    new THREE.MeshBasicMaterial({ color: sim.wifi ? 0x9fc4ff : 0xff6b6b, transparent: true, opacity: 0.8, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(D.escritorio.x, 1.02, D.escritorio.z); m.userData.t = 0; escena.add(m); anillos.push(m);
}

function actualizarCurva() {
  hab.cartel.grupo.getWorldPosition(destino); destino.x += 0.06;
  medio.set((origenPaquete.x + destino.x) / 2, Math.max(origenPaquete.y, destino.y) + 1.15, (origenPaquete.z + destino.z) / 2);
  const pts = curva.getPoints(28);
  lineaGeo.setFromPoints(pts); linea.computeLineDistances();
  linea.material.color.setHex(sim.wifi ? 0x5b6b8f : 0x8a4a4a);
}

function moverPaquetes(dt) {
  for (let i = paquetes.length - 1; i >= 0; i--) {
    const p = paquetes[i];
    const f = (visual - p.inicio) / 1000 / TIEMPO_VIAJE;
    if (!p.malla) {
      const color = !p.ok ? 0x7a8196 : p.estado === N.OCUPADO ? 0xff3b3b : 0x2fe370;
      p.malla = new THREE.Mesh(geoBola, new THREE.MeshBasicMaterial({ color, transparent: true, toneMapped: false }));
      if (p.latido) p.malla.scale.setScalar(0.65);
      escena.add(p.malla);
    }
    const tope = p.ok ? 1 : 0.55;
    const e = Math.min(f, tope);
    curva.getPoint(e * e * (3 - 2 * e), p.malla.position);
    p.malla.material.opacity = f > tope ? Math.max(0, 1 - (f - tope) * 6) : 1;
    if (f >= 1 && !p.entregado) {
      p.entregado = true;
      if (p.ok) {
        cartel.recibirOrden(p.estado, visual, logico);
        logHttp(`${p.latido ? 'latido ' : ''}GET ${p.ruta} → 200 OK`, p.latido ? '' : (p.estado === N.OCUPADO ? 'rojo' : 'verde'));
        hab.cartel.ledEsp.material.color.setHex(0xffffff); setTimeout(() => hab.cartel.ledEsp.material.color.setHex(0x2fe370), 120);
      } else logHttp(`GET ${p.ruta} → sin respuesta (timeout)`, 'mal');
    }
    if (p.entregado && f > 1.3) { escena.remove(p.malla); p.malla.material.dispose(); paquetes.splice(i, 1); }
  }
  for (let i = anillos.length - 1; i >= 0; i--) {
    const a = anillos[i]; a.userData.t += dt;
    const k = a.userData.t / 0.9;
    a.scale.setScalar(1 + k * 5); a.material.opacity = Math.max(0, 0.8 * (1 - k));
    if (k >= 1) { escena.remove(a); a.geometry.dispose(); a.material.dispose(); anillos.splice(i, 1); }
  }
}

// ===========================================================================
//  GUION  (corrutinas muy simples: `yield número` = esperar segundos;
//          `yield () => condición` = esperar hasta que sea verdad)
// ===========================================================================
const tareas = [];
function lanzar(gen) { tareas.push({ it: gen(), espera: 0, cond: null }); }
function avanzarTareas(dt) {
  for (const t of tareas) {
    if (t.espera > 0) { t.espera -= dt; if (t.espera > 0) continue; }
    if (t.cond) { if (!t.cond()) continue; t.cond = null; }
    let r = t.it.next();
    while (!r.done) {
      const v = r.value;
      if (typeof v === 'number') { t.espera = v; break; }
      if (typeof v === 'function' && !v()) { t.cond = v; break; }
      r = t.it.next();
    }
  }
}

function* tareaMama() {
  while (true) {
    mamaEst.modo = 'trabajo'; mamaEst.t = 0;
    mama.poner('sentado'); mama.capasObjetivo.teclear = 1; mama.capasObjetivo.hablar = 0;
    yield () => sim.llamar || (sim.auto && mamaEst.t > 8 && !dentro);
    sim.llamar = false;

    mamaEst.modo = 'suena'; mamaEst.t = 0; mama.capasObjetivo.teclear = 0;
    mama.tgt.shRx = -0.78; mama.tgt.elRx = -0.95;         // la mano derecha va hacia el ratón
    yield () => mamaEst.t > 3.0;

    mamaEst.modo = 'llamada'; mamaEst.t = 0; sim.mic = true;
    mama.poner('sentado_habla'); mama.capasObjetivo.hablar = 1;
    yield () => sim.colgar || (sim.auto && mamaEst.t > 26);
    sim.colgar = false;

    mamaEst.dur = mamaEst.t; mamaEst.modo = 'fin'; mamaEst.t = 0; sim.mic = false;
    mama.poner('sentado'); mama.capasObjetivo.hablar = 0; mama.capasObjetivo.teclear = 0;
    yield () => mamaEst.t > 2.5;
  }
}

function* abrirPuerta(abierta) { puertaObj = abierta ? 1 : 0; yield () => Math.abs(puertaF - puertaObj) < 0.01; }

function* tareaVisitantes() {
  yield 1;
  while (true) {
    // Llegan cuando la llamada lleva un rato y el cartel YA está en rojo.
    yield () => mamaEst.modo === 'llamada' && mamaEst.t > 5 && cartel.estado === N.OCUPADO && !dentro;
    dentro = true;
    v1.posicion(0.95, 2.9); v2.posicion(1.45, 3.4);
    for (const v of visitantes) { v.root.visible = true; v.poner('de_pie'); }
    v1.teletransportarYaw(Math.PI); v2.teletransportarYaw(Math.PI);
    // Se paran a un lado del cartel (z > 0.5) para no taparlo desde la cámara general.
    v1.caminar([[0.95, 1.4], [1.0, 0.85]]);
    yield 1.4;
    v2.caminar([[1.35, 1.8], [1.5, 1.3]]);
    yield () => v1.llegado && v2.llegado;
    v1.mirarA(0, -0.1); v2.mirarA(0, -0.1);
    yield 0.6;

    // Leen el cartel. Si está en rojo, reaccionan (uno piensa, la otra mira el reloj y se da la
    // vuelta); si ya está en verde, pasan directos.
    if (cartel.estado === N.OCUPADO) {
      v1.poner('pensar'); v2.poner('mirar_reloj');
      yield 2.4;
      v1.poner('cruzado');
      v2.poner('de_pie'); v2.caminar([[1.65, 1.0]]); v2.orientar(0);   // se da la vuelta y se aleja un poco
      yield () => v2.llegado;
      yield 0.8;
      v2.mirarA(0.2, -0.1); v2.poner('cruzado');                         // y espera mirando la puerta
    }

    // Esperan hasta que el cartel (el REAL, el que muestra la escena) diga PASAR.
    yield () => cartel.estado === N.LIBRE && !cartel.enTransicion;
    yield 0.9;
    v1.poner('de_pie'); v2.poner('de_pie');
    v1.caminar([[0.55, 0.3]]);
    yield () => v1.llegado;
    v1.mirarA(0, 0.25); v1.poner('alcanzar');
    yield 0.7;
    yield* abrirPuerta(true);
    v1.poner('de_pie');
    mama.tgt.headY = -0.75;                                   // mamá mira hacia la puerta
    v1.caminar([[0.15, -0.15], [-0.45, -0.12], [-0.85, -0.3]]);
    yield 1.1;
    v2.caminar([[0.9, 0.35], [0.5, -0.1], [0.0, -0.15], [-0.7, -0.1], [-1.2, 0.4]]);
    yield () => v1.llegado && v2.llegado;
    v1.mirarA(D.silla.x, D.silla.z); v2.mirarA(D.silla.x, D.silla.z);
    v1.poner('saludar');
    yield 3.4;
    v1.poner('de_pie');

    // Se van; la puerta se cierra detrás.
    mama.tgt.headY = 0;
    v1.caminar([[-0.45, -0.12], [0.15, -0.15], [0.7, 0.1], [0.95, 0.9], [1.0, 3.0]]);
    yield 0.9;
    v2.caminar([[-0.7, -0.1], [0.0, -0.15], [0.5, 0.0], [1.0, 0.9], [1.4, 3.4]]);
    yield () => v1.root.position.x > 0.5 && v2.root.position.x > 0.5;
    yield* abrirPuerta(false);
    yield () => v1.llegado && v2.llegado;
    for (const v of visitantes) v.root.visible = false;
    dentro = false;
    yield 6;
  }
}

lanzar(tareaMama);
lanzar(tareaVisitantes);

// ------------------------------------------------------------------- Interfaz
const chips = { libre: $('st-libre'), llamada: $('st-llamada'), antirrebote: $('st-antirrebote') };
const lupa = $('lupa'), lupaCtx = lupa ? lupa.getContext('2d') : null;
const ctxCartel = hab.cartel.canvas.getContext('2d');
const COLOR_ESTADO = { arrancando: 'ARRANCANDO…', neutro: '? SIN SEÑAL', libre: 'PASAR', ocupado: 'NO PASAR' };
let ultimaUI = 0, ultimoDibujoCartel = 0, ultimoDibujoPantalla = 0, resumenLuz = { sr: 0, sg: 0, sb: 0, sInt: 0 };

function actualizarTelemetria(frame) {
  const enLlamada = sim.mic;
  const antirrebote = !sim.mic && agente.confirmado === N.OCUPADO;
  chips.libre.classList.toggle('on', !enLlamada && !antirrebote);
  chips.llamada.classList.toggle('on', enLlamada);
  chips.antirrebote.classList.toggle('on', antirrebote);
  const rest = agente.restanteLibre(logico, sim.mic);
  $('st-cuenta').textContent = antirrebote && rest !== null ? `espera ${(rest / 1000).toFixed(1)} s antes de PASAR` :
    enLlamada ? 'micrófono EN USO → NO PASAR' : 'micrófono libre';
  const hl = agente.hastaLatido(logico);
  $('hw-pc-latido').textContent = hl === null ? '—' : `próximo en ${Math.ceil(hl / 1000)} s`;

  const e = $('st-cartel');
  e.textContent = COLOR_ESTADO[cartel.estado];
  e.className = 'valor cartel-' + cartel.estado;
  $('hw-brillo').textContent = `${frame.brillo}/${N.BRILLO_MAX}`;
  $('hw-ma').textContent = `${Math.round(frame.ma)} mA`;
  $('hw-barra').style.width = Math.min(100, (frame.ma / 2400) * 100) + '%';
  const vivo = cartel.estado === N.OCUPADO || cartel.estado === N.LIBRE;
  const seg = cartel.segundosDesdeLatido(logico);
  $('hw-latido').textContent = vivo ? `hace ${Math.floor(seg)} s (límite 45 s)` : '—';
  $('hw-wifi').textContent = sim.wifi ? 'conectado · cartel.local' : 'SIN CONEXIÓN';
  $('hw-wifi').className = sim.wifi ? '' : 'mal';
}

// ------------------------------------------------------------------- Bucle
const reloj = new THREE.Clock();
let primera = true;
function actualizar(dt) {
  visual += dt * 1000;
  logico += dt * 1000 * velocidad;
  while (proximoTick <= logico) { pasoAgente(proximoTick); proximoTick += 1000; }

  mamaEst.t += dt;
  avanzarTareas(dt);
  puertaF += Math.max(-dt / 1.3, Math.min(dt / 1.3, puertaObj - puertaF));
  const sua = puertaF * puertaF * (3 - 2 * puertaF);
  hab.puerta.abrir(sua);
  personas.forEach((p) => p.update(dt));

  moverPaquetes(dt);
  cartel.comprobarLatido(visual, logico);
  const frame = cartel.fotograma(visual, logico);
  while (cartel.registro.length) logHttp('ESP32 ' + cartel.registro.shift(), 'dim');

  // Cartel de la puerta (textura) a ~30 fps
  if (visual - ultimoDibujoCartel > 33) {
    ultimoDibujoCartel = visual;
    resumenLuz = pintarLeds(ctxCartel, 512, 128, frame.marco, frame.brillo, N);
    hab.cartel.textura.needsUpdate = true;
    if (lupa && !document.hidden) pintarLeds(lupaCtx, lupa.width, lupa.height, frame.marco, frame.brillo, N);
  }
  // La luz del cartel se derrama sobre la puerta y el suelo del pasillo, con su color
  const s = resumenLuz;
  if (s.sInt > 0.5) {
    const mx = Math.max(s.sr, s.sg, s.sb, 1);
    const col = new THREE.Color(s.sr / mx, s.sg / mx, s.sb / mx);
    hab.cartel.luz.color.copy(col); hab.cartel.luz.intensity = Math.min(1.25, s.sInt / 50);
    hab.cartel.halo.material.color.copy(col); hab.cartel.halo.material.opacity = Math.min(0.42, s.sInt / 130);
    hab.cartel.suelo.material.color.copy(col); hab.cartel.suelo.material.opacity = Math.min(0.34, s.sInt / 170);
  } else { hab.cartel.luz.intensity = 0; hab.cartel.halo.material.opacity = 0; hab.cartel.suelo.material.opacity = 0; }

  // Pantalla del portátil (solo se redibuja si cambia algo visible)
  const animada = mamaEst.modo === 'suena' || mamaEst.modo === 'llamada' || mamaEst.modo === 'trabajo';
  if (visual - ultimoDibujoPantalla > (animada ? 50 : 400)) {
    ultimoDibujoPantalla = visual;
    hab.portatil.pantalla.dibujar(mamaEst.modo, mamaEst.t, mamaEst.dur);
  }
  hab.portatil.luz.intensity = sim.mic ? 0.9 : 0.25;

  if (visual - ultimaUI > 100) { ultimaUI = visual; actualizarTelemetria(frame); }
  if (visual % 40 < 17 || primera) actualizarCurva();

  // Cámara: transición suave entre vistas predefinidas
  if (tween) {
    tween.t += dt / tween.dur;
    const k = Math.min(1, tween.t), e = k * k * (3 - 2 * k);
    camara.position.lerpVectors(tween.p0, tween.p1, e);
    controles.target.lerpVectors(tween.t0, tween.t1, e);
    if (k >= 1) tween = null;
  }
  controles.target.x = Math.max(-3.2, Math.min(2.2, controles.target.x));
  controles.target.y = Math.max(0.2, Math.min(2.0, controles.target.y));
  controles.target.z = Math.max(-2.0, Math.min(2.2, controles.target.z));
  controles.update();

  renderer.render(escena, camara);
  primera = false;
}
function bucle() {
  actualizar(Math.min(0.1, reloj.getDelta()));
  requestAnimationFrame(bucle);
}
// Para pruebas: avanza la simulación `seg` segundos de golpe, sin depender de requestAnimationFrame.
function avanzar(seg, paso = 1 / 30) { for (let t = 0; t < seg; t += paso) actualizar(paso); }

// ---------------------------------------------------------------- Controles
function ajustarTamano() {
  const cont = canvas.parentElement;
  const w = cont.clientWidth, h = cont.clientHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 700 ? 1.5 : 2));
  renderer.setSize(w, h, false);
  camara.aspect = w / h;
  // En pantallas estrechas (móvil vertical) abro el campo de visión para que quepa la maqueta.
  camara.fov = camara.aspect < 0.8 ? 46 : camara.aspect < 1.2 ? 44 : 38;
  camara.updateProjectionMatrix();
}
new ResizeObserver(ajustarTamano).observe(canvas.parentElement);

$('btn-llamada').addEventListener('click', () => { if (mamaEst.modo === 'trabajo' || mamaEst.modo === 'fin') sim.llamar = true; });
$('btn-colgar').addEventListener('click', () => { if (mamaEst.modo === 'llamada') sim.colgar = true; });
function pintarAuto() {
  const b = $('btn-auto');
  b.setAttribute('aria-pressed', String(sim.auto));
  b.textContent = sim.auto ? '⏸ Guion automático' : '▶ Guion automático';
}
$('btn-auto').addEventListener('click', () => { sim.auto = !sim.auto; pintarAuto(); });
$('btn-wifi').addEventListener('click', () => {
  sim.wifi = !sim.wifi;
  const b = $('btn-wifi'); b.setAttribute('aria-pressed', String(!sim.wifi));
  b.textContent = sim.wifi ? '📡 Cortar WiFi' : '📡 Restaurar WiFi';
  logHttp(sim.wifi ? 'WiFi restaurado' : 'WiFi cortado (simulado)', 'aviso');
});
document.querySelectorAll('.seg').forEach((b) => b.addEventListener('click', () => {
  velocidad = Number(b.dataset.vel);
  document.querySelectorAll('.seg').forEach((x) => x.classList.toggle('activo', x === b));
}));
document.querySelectorAll('.cam').forEach((b) => b.addEventListener('click', () => irACamara(b.dataset.cam)));
$('brillo').addEventListener('input', (ev) => { cartel.brillo = Number(ev.target.value); $('v-brillo').textContent = ev.target.value; });
$('btn-panel').addEventListener('click', () => {
  const abierto = document.body.classList.toggle('panel-abierto');
  $('btn-panel').setAttribute('aria-expanded', String(abierto));
});
document.addEventListener('visibilitychange', () => { reloj.getDelta(); });

// ------------------------------------------------------------------- Arranque
ajustarTamano();
irACamara('general', true);
pintarAuto();
if (reducido) logHttp('Movimiento reducido: guion automático desactivado. Usa «Llamada entrante».', 'aviso');
logHttp('Agente iniciado. Cartel: cartel.local:80, latido 15 s, retardo a PASAR 5 s', 'dim');
$('cargando').classList.add('oculto');
setTimeout(() => { $('cargando').style.display = 'none'; }, 700);
window.__3dListo = true;
// Modo captura (para generar imágenes del README): ?captura=SEGUNDOS[&cam=general|cartel|escritorio]
// avanza el guion automático hasta ese instante y se queda quieto.
const params = new URLSearchParams(location.search);
window.__sim3d = { avanzar, cartel, agente, sim, mama, v1, v2, irACamara, camara, controles, renderer, escena, hab, mamaEst };
if (params.has('captura')) {
  sim.auto = true;
  if (params.get('cam')) irACamara(params.get('cam'), true);
  avanzar(parseFloat(params.get('captura')) || 0, 1 / 15);
  const repintar = () => { renderer.render(escena, camara); requestAnimationFrame(repintar); };
  repintar();
  document.body.dataset.listo = '1';
} else bucle();
