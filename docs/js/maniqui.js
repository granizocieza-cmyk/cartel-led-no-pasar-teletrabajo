/* =============================================================================
 *  maniqui.js — Figura de maqueta articulada, hecha solo con geometría de three.js
 * =============================================================================
 *  Sin caras ni ropa: cápsulas y esferas de madera clara, como un maniquí de
 *  dibujo. Cada articulación es un Group ("pivote"); animar = girar pivotes.
 *
 *  Convenios (la figura mira hacia +Z cuando root.rotation.y = 0):
 *    - su izquierda es +X local; su derecha es -X local.
 *    - girar un hombro/cadera con rotation.x NEGATIVO lleva el miembro hacia delante.
 *    - girar la rodilla/codo con rotation.x POSITIVO (rodilla) o NEGATIVO (codo) los dobla.
 * ========================================================================== */
import * as THREE from 'three';

const mate = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.93, metalness: 0 });

// Poses de partida (ángulos en radianes). Cada pose es un "objetivo" al que el
// maniquí se acerca suavemente; encima se suman las capas procedurales
// (caminar, teclear, hablar) según su amplitud.
const BASE = {
  hipsY: 0.93, spineX: 0, spineY: 0, headX: 0, headY: 0,
  shLx: 0, shLz: 0.08, elLx: -0.05, shRx: 0, shRz: -0.08, elRx: -0.05,
  hipLx: 0, kneeLx: 0, hipRx: 0, kneeRx: 0, bloqueoBrazos: 0,
};
export const POSES = {
  de_pie: {},
  sentado: { hipsY: 0.5, hipLx: -1.55, hipRx: -1.55, kneeLx: 1.55, kneeRx: 1.55, spineX: 0.06,
             shLx: -0.62, shRx: -0.62, elLx: -1.05, elRx: -1.05, shLz: 0.05, shRz: -0.05, bloqueoBrazos: 1 },
  // sentado, hablando: la mano derecha sube y gesticula (se anima con la capa "habla")
  sentado_habla: { hipsY: 0.5, hipLx: -1.55, hipRx: -1.55, kneeLx: 1.55, kneeRx: 1.55, spineX: 0.02,
                   shLx: -0.62, elLx: -1.05, shRx: -1.0, shRz: -0.35, elRx: -1.5, shLz: 0.05, bloqueoBrazos: 1 },
  alcanzar: { shRx: -1.35, elRx: -0.12, shRz: -0.05, spineX: 0.05, bloqueoBrazos: 1 },
  parar: { shRx: -1.55, elRx: -0.25, shRz: -0.12, bloqueoBrazos: 1 },
  pensar: { shRx: -1.05, elRx: -2.1, shRz: -0.15, shLx: -0.55, elLx: -1.9, shLz: 0.1, headX: 0.12, bloqueoBrazos: 1 },
  cruzado: { shRx: -0.55, elRx: -1.95, shRz: -0.3, shLx: -0.55, elLx: -1.95, shLz: 0.3, bloqueoBrazos: 1 },
  saludar: { shRx: -2.55, elRx: -0.55, shRz: -0.35, bloqueoBrazos: 1 },
  mirar_reloj: { shLx: -0.9, elLx: -1.9, shLz: 0.05, headX: 0.22, bloqueoBrazos: 1 },
};

export class Maniqui {
  constructor({ color = 0xdccaa9, acento = 0xb9a07a, cascos = false } = {}) {
    this.root = new THREE.Group();
    const m = mate(color), mj = mate(acento);
    const sombra = (mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; };
    const caps = (r, l, mat) => sombra(new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 10), mat));
    const esf = (r, mat) => sombra(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat));

    // --- Tronco ---------------------------------------------------------
    this.hips = new THREE.Group(); this.hips.position.y = BASE.hipsY; this.root.add(this.hips);
    const pelvis = esf(0.115, mj); pelvis.scale.set(1.15, 0.8, 0.9); this.hips.add(pelvis);
    this.spine = new THREE.Group(); this.hips.add(this.spine);
    const torso = caps(0.125, 0.3, m); torso.position.y = 0.26; torso.scale.set(1.2, 1, 0.78); this.spine.add(torso);
    const cuello = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.04, 0.09, 10), mj));
    cuello.position.y = 0.55; this.spine.add(cuello);
    this.head = new THREE.Group(); this.head.position.y = 0.6; this.spine.add(this.head);
    const cabeza = esf(0.102, m); cabeza.position.y = 0.105; cabeza.scale.set(0.92, 1.12, 1); this.head.add(cabeza);

    // --- Auriculares con micro (para la persona que teletrabaja) ----------
    this.cascos = new THREE.Group(); this.cascos.visible = cascos; this.head.add(this.cascos);
    const negro = mate(0x2a2e35);
    const arco = sombra(new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.01, 8, 24, Math.PI), negro));
    arco.position.y = 0.105; arco.rotation.z = 0; arco.rotation.y = Math.PI / 2; this.cascos.add(arco);
    for (const lado of [-1, 1]) {
      const copa = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 14), negro));
      copa.rotation.z = Math.PI / 2; copa.position.set(0.108 * lado, 0.1, 0); this.cascos.add(copa);
    }
    const brazoMicro = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.11, 6), negro));
    brazoMicro.position.set(-0.1, 0.06, 0.05); brazoMicro.rotation.set(0.9, 0, 0.5); this.cascos.add(brazoMicro);
    const puntaMicro = esf(0.012, negro); puntaMicro.position.set(-0.075, 0.03, 0.095); this.cascos.add(puntaMicro);

    // --- Brazos ---------------------------------------------------------
    const crearBrazo = (lado) => {
      const hombro = new THREE.Group(); hombro.position.set(0.19 * lado, 0.46, 0); this.spine.add(hombro);
      hombro.add(esf(0.05, mj));
      const brazo = caps(0.04, 0.2, m); brazo.position.y = -0.16; hombro.add(brazo);
      const codo = new THREE.Group(); codo.position.y = -0.3; hombro.add(codo);
      codo.add(esf(0.04, mj));
      const antebrazo = caps(0.035, 0.18, m); antebrazo.position.y = -0.15; codo.add(antebrazo);
      const mano = esf(0.043, mj); mano.position.y = -0.3; codo.add(mano);
      return { hombro, codo };
    };
    this.brazoL = crearBrazo(1);
    this.brazoR = crearBrazo(-1);

    // --- Piernas --------------------------------------------------------
    const crearPierna = (lado) => {
      const cadera = new THREE.Group(); cadera.position.set(0.085 * lado, -0.02, 0); this.hips.add(cadera);
      const muslo = caps(0.062, 0.3, m); muslo.position.y = -0.2; cadera.add(muslo);
      const rodilla = new THREE.Group(); rodilla.position.y = -0.42; cadera.add(rodilla);
      rodilla.add(esf(0.055, mj));
      const pantorrilla = caps(0.05, 0.3, m); pantorrilla.position.y = -0.2; rodilla.add(pantorrilla);
      const pie = sombra(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.055, 0.21), mj));
      pie.position.set(0, -0.435, 0.05); rodilla.add(pie);
      return { cadera, rodilla };
    };
    this.piernaL = crearPierna(1);
    this.piernaR = crearPierna(-1);

    // --- Estado de animación ---------------------------------------------
    this.cur = { ...BASE };
    this.tgt = { ...BASE };
    this.capas = { caminar: 0, teclear: 0, hablar: 0 };      // amplitudes actuales
    this.capasObjetivo = { caminar: 0, teclear: 0, hablar: 0 };
    this.fase = 0;            // fase del paso
    this.reloj = 0;
    this.destino = null;      // {x,z,vel}
    this.cola = [];           // puntos pendientes
    this.yawObjetivo = 0;
    this.llegado = true;
    this.movimientoReducido = false;
  }

  poner(nombre) { this.tgt = { ...BASE, ...(POSES[nombre] || {}) }; return this; }
  posicion(x, z) { this.root.position.set(x, 0, z); return this; }
  orientar(yaw) { this.yawObjetivo = yaw; return this; }
  mirarA(x, z) { this.yawObjetivo = Math.atan2(x - this.root.position.x, z - this.root.position.z); return this; }
  teletransportarYaw(yaw) { this.yawObjetivo = yaw; this.root.rotation.y = yaw; return this; }

  // Camina por una lista de puntos [[x,z], ...] a `vel` m/s.
  caminar(puntos, vel = 1.05) {
    this.cola = puntos.map(([x, z]) => ({ x, z, vel }));
    this.llegado = this.cola.length === 0;
    return this;
  }

  update(dt) {
    this.reloj += dt;
    const p = this.root.position;

    // 1) Desplazamiento
    let andando = false;
    if (this.cola.length) {
      const d = this.cola[0];
      const dx = d.x - p.x, dz = d.z - p.z, dist = Math.hypot(dx, dz);
      if (dist < 0.03) { p.x = d.x; p.z = d.z; this.cola.shift(); if (!this.cola.length) this.llegado = true; }
      else {
        const paso = Math.min(dist, d.vel * dt);
        p.x += (dx / dist) * paso; p.z += (dz / dist) * paso;
        this.yawObjetivo = Math.atan2(dx, dz);
        andando = true;
        this.fase += d.vel * dt * 5.6;
      }
    }
    this.capasObjetivo.caminar = andando ? 1 : 0;

    // 2) Giro suave por el camino más corto
    let dy = this.yawObjetivo - this.root.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.root.rotation.y += dy * (1 - Math.exp(-8 * dt));

    // 3) Acercar ángulos al objetivo (suavizado exponencial) y capas
    const k = 1 - Math.exp(-7 * dt);
    for (const n in this.tgt) this.cur[n] += (this.tgt[n] - this.cur[n]) * k;
    for (const n in this.capas) this.capas[n] += (this.capasObjetivo[n] - this.capas[n]) * k;
    const mr = this.movimientoReducido ? 0.25 : 1;

    const c = this.cur, w = this.capas.caminar, t = this.reloj;
    const s = Math.sin(this.fase), s2 = Math.sin(this.fase + Math.PI);
    const libres = 1 - Math.min(1, c.bloqueoBrazos);          // 1 = brazos colgando (se balancean al andar)

    // capas de gesto
    const teclear = this.capas.teclear * mr, hablar = this.capas.hablar * mr;
    const tec = Math.sin(t * 14) * 0.035 * teclear, tec2 = Math.sin(t * 11 + 1) * 0.035 * teclear;
    const gesto = Math.sin(t * 3.1) * 0.22 * hablar + Math.sin(t * 5.3) * 0.08 * hablar;

    this.hips.position.y = c.hipsY + Math.abs(Math.sin(this.fase)) * 0.025 * w;
    this.spine.rotation.set(c.spineX, c.spineY + Math.sin(this.fase) * 0.06 * w, 0);
    this.head.rotation.set(c.headX + Math.sin(t * 2.2) * 0.05 * hablar, c.headY, 0);

    this.brazoL.hombro.rotation.set(c.shLx + s2 * 0.55 * w * libres + tec, 0, c.shLz);
    this.brazoL.codo.rotation.set(c.elLx - Math.max(0, s2) * 0.25 * w * libres + tec2, 0, 0);
    this.brazoR.hombro.rotation.set(c.shRx + s * 0.55 * w * libres - gesto * 0.4, 0, c.shRz);
    this.brazoR.codo.rotation.set(c.elRx - Math.max(0, s) * 0.25 * w * libres - gesto, 0, 0);

    this.piernaL.cadera.rotation.set(c.hipLx + s * 0.55 * w, 0, 0);
    this.piernaL.rodilla.rotation.set(c.kneeLx + Math.max(0, -s) * 0.7 * w, 0, 0);
    this.piernaR.cadera.rotation.set(c.hipRx + s2 * 0.55 * w, 0, 0);
    this.piernaR.rodilla.rotation.set(c.kneeRx + Math.max(0, -s2) * 0.7 * w, 0, 0);
  }
}
