/* =============================================================================
 *  maniqui.js — Personas de la maqueta, con geometría propia de three.js
 * =============================================================================
 *  POR QUÉ geometría propia y no modelos glTF (Quaternius, Kenney...):
 *    - cero descargas y cero licencias que mantener (el repo no lleva ni un archivo externo);
 *    - el esqueleto de grupos (cadera, columna, hombros, codos, rodillas, tobillos) es el
 *      que ya usa el guion, así que las poses y los tiempos no cambian;
 *    - se puede ajustar cada prenda y cada peinado con unas pocas líneas;
 *    - pesa unos pocos KB y renderiza fluido en móvil (geometrías compartidas).
 *
 *  Cada persona se arma con formas torneadas (cilindros cónicos y esferas
 *  achatadas): cabeza con cuello y mandíbula, hombros, torso, cadera, brazos con
 *  codo y mano, piernas con rodilla y pies con zapato. Lleva pelo, ropa y calzado
 *  de colores distintos. La cara es mínima: nariz, orejas y dos puntitos de ojos.
 *
 *  Convenios (la figura mira hacia +Z cuando root.rotation.y = 0):
 *    - su izquierda es +X local; su derecha es -X local.
 *    - girar un hombro/cadera con rotation.x NEGATIVO lleva el miembro hacia delante.
 *    - la rodilla se dobla con rotation.x POSITIVO; el codo con rotation.x NEGATIVO.
 * ========================================================================== */
import * as THREE from 'three';

const mate = (color, rug = 0.88) => new THREE.MeshStandardMaterial({ color, roughness: rug, metalness: 0 });

// Geometrías compartidas entre todas las personas (menos memoria y menos llamadas).
const CACHE = new Map();
const geo = (clave, fabricar) => { if (!CACHE.has(clave)) CACHE.set(clave, fabricar()); return CACHE.get(clave); };
const sombrear = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

/** Cilindro cónico que cuelga hacia abajo desde el origen (para brazos y piernas). */
function miembro(rArriba, rAbajo, largo, mat) {
  const g = geo(`m${rArriba}/${rAbajo}/${largo}`, () => { const c = new THREE.CylinderGeometry(rArriba, rAbajo, largo, 14, 1); c.translate(0, -largo / 2, 0); return c; });
  return sombrear(new THREE.Mesh(g, mat));
}
const en = (m, x, y, z) => { m.position.set(x, y, z); return m; };
function esfera(r, mat, sx = 1, sy = 1, sz = 1) {
  const m = sombrear(new THREE.Mesh(geo(`e${r}`, () => new THREE.SphereGeometry(r, 18, 14)), mat));
  m.scale.set(sx, sy, sz); return m;
}

// Poses de partida (ángulos en radianes). Cada pose es un "objetivo" al que la persona se
// acerca suavemente; encima se suman las capas procedurales (caminar, teclear, hablar).
const BASE = {
  hipsY: 0.93, spineX: 0, spineY: 0, headX: 0, headY: 0,
  shLx: 0, shLz: 0.08, elLx: -0.1, shRx: 0, shRz: -0.08, elRx: -0.1,
  hipLx: 0, kneeLx: 0, hipRx: 0, kneeRx: 0, bloqueoBrazos: 0,
};
export const POSES = {
  de_pie: {},
  sentado: { hipsY: 0.5, hipLx: -1.55, hipRx: -1.55, kneeLx: 1.55, kneeRx: 1.55, spineX: 0.06, headX: 0.14,
             shLx: -0.62, shRx: -0.62, elLx: -1.05, elRx: -1.05, shLz: 0.05, shRz: -0.05, bloqueoBrazos: 1 },
  // sentado, hablando: la mano derecha sube y gesticula (se anima con la capa "habla")
  sentado_habla: { hipsY: 0.5, hipLx: -1.55, hipRx: -1.55, kneeLx: 1.55, kneeRx: 1.55, spineX: 0.02, headX: 0.04,
                   shLx: -0.62, elLx: -1.05, shRx: -1.0, shRz: -0.35, elRx: -1.5, shLz: 0.05, bloqueoBrazos: 1 },
  alcanzar: { shRx: -1.35, elRx: -0.12, shRz: -0.05, spineX: 0.05, bloqueoBrazos: 1 },
  parar: { shRx: -1.55, elRx: -0.25, shRz: -0.12, bloqueoBrazos: 1 },
  pensar: { shRx: -1.05, elRx: -2.1, shRz: -0.15, shLx: -0.55, elLx: -1.9, shLz: 0.1, headX: 0.12, bloqueoBrazos: 1 },
  cruzado: { shRx: -0.55, elRx: -1.95, shRz: -0.3, shLx: -0.55, elLx: -1.95, shLz: 0.3, bloqueoBrazos: 1 },
  saludar: { shRx: -2.55, elRx: -0.55, shRz: -0.35, bloqueoBrazos: 1 },
  mirar_reloj: { shLx: -0.9, elLx: -1.9, shLz: 0.05, headX: 0.22, bloqueoBrazos: 1 },
};

// Paleta sobria: tonos apagados para que solo el rojo y el verde del cartel destaquen.
export const ESTILOS = {
  mama: { piel: 0xd8a98a, pelo: { estilo: 'largo', color: 0x4a3326 },
          prenda: { tipo: 'sudadera', color: 0x5f6f86 }, pantalon: 0x3a4a63, zapatos: 0xe9e6df, suela: 0xc9c4ba, cascos: true },
  visitante1: { piel: 0xc79574, pelo: { estilo: 'corto', color: 0x24201d },
                prenda: { tipo: 'camisa', color: 0x9db4cf }, pantalon: 0xb2a387, zapatos: 0x5b4332, suela: 0x2a2623 },
  visitante2: { piel: 0xe6c3a5, pelo: { estilo: 'coleta', color: 0x8a4f32 },
                prenda: { tipo: 'camiseta', color: 0xe9e4d8 }, pantalon: 0x30353e, zapatos: 0x8a9098, suela: 0xe6e3dc },
};

export class Maniqui {
  constructor(opts = {}) {
    const { piel = 0xd8a98a, pelo = { estilo: 'corto', color: 0x2a211c }, prenda = { tipo: 'camiseta', color: 0x888888 },
            pantalon = 0x3d4a5e, zapatos = 0xe8e6e1, suela = 0xcfcac2, cascos = false } = opts;
    const larga = prenda.tipo !== 'camiseta';                       // manga larga (sudadera, camisa)
    const mPiel = mate(piel, 0.8), mPelo = mate(pelo.color, 0.95), mPrenda = mate(prenda.color, 0.92);
    const mPantalon = mate(pantalon, 0.9), mZapato = mate(zapatos, 0.75), mSuela = mate(suela, 0.9);
    const mOscuro = mate(0x15171b, 0.6);

    this.root = new THREE.Group();

    // --- Cadera y tronco ---------------------------------------------------------
    this.hips = new THREE.Group(); this.hips.position.y = BASE.hipsY; this.root.add(this.hips);
    this.hips.add(esfera(0.12, mPantalon, 1.3, 0.88, 0.95));                                   // pelvis
    this.spine = new THREE.Group(); this.hips.add(this.spine);
    const torso = sombrear(new THREE.Mesh(geo('torso', () => new THREE.CylinderGeometry(0.165, 0.128, 0.6, 20, 1)), mPrenda));
    torso.position.y = 0.23; torso.scale.z = 0.64; this.spine.add(torso);                      // pecho a cintura
    const hombrosTop = esfera(0.165, mPrenda, 1.02, 0.32, 0.66); hombrosTop.position.y = 0.515; this.spine.add(hombrosTop);
    const cuello = sombrear(new THREE.Mesh(geo('cuello', () => new THREE.CylinderGeometry(0.036, 0.042, 0.1, 12)), mPiel));
    cuello.position.y = 0.57; this.spine.add(cuello);

    // Detalle de prenda en el cuello: cuello redondo (camiseta), capucha (sudadera) o cuello de camisa
    if (prenda.tipo === 'sudadera') {
      const capucha = sombrear(new THREE.Mesh(geo('capucha', () => new THREE.TorusGeometry(0.075, 0.032, 10, 22)), mPrenda));
      capucha.rotation.x = Math.PI / 2.4; capucha.position.set(0, 0.545, -0.015); this.spine.add(capucha);
    } else if (prenda.tipo === 'camisa') {
      for (const lado of [-1, 1]) {
        const solapa = sombrear(new THREE.Mesh(geo('solapa', () => new THREE.BoxGeometry(0.06, 0.04, 0.012)), mate(0xe9eef5, 0.9)));
        solapa.position.set(0.032 * lado, 0.545, 0.075); solapa.rotation.set(0.5, 0, -0.5 * lado); this.spine.add(solapa);
      }
    } else {
      const ring = sombrear(new THREE.Mesh(geo('cuelloRedondo', () => new THREE.TorusGeometry(0.052, 0.014, 10, 32)), mPrenda));
      ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.535, 0.005); this.spine.add(ring);
    }

    // --- Cabeza ---------------------------------------------------------------------
    this.head = new THREE.Group(); this.head.position.y = 0.61; this.spine.add(this.head);
    this.head.add(en(esfera(0.1, mPiel, 0.88, 1.08, 0.97), 0, 0.105, 0));   // cráneo
    this.head.add(en(esfera(0.044, mPiel, 0.95, 0.8, 0.9), 0, 0.034, 0.05));   // barbilla
    this.head.add(en(esfera(0.015, mPiel, 0.9, 1.1, 1.2), 0, 0.085, 0.096));  // nariz
    for (const lado of [-1, 1]) {
      this.head.add(en(esfera(0.019, mPiel, 0.5, 1, 0.9), 0.089 * lado, 0.1, -0.005)); // orejas
      this.head.add(en(esfera(0.0095, mOscuro, 1, 1.2, 0.8), 0.034 * lado, 0.118, 0.092)); // ojos mínimos
    }
    this._pelo(this.head, pelo.estilo, mPelo);

    // Auriculares con micro
    this.cascos = new THREE.Group(); this.cascos.visible = cascos; this.head.add(this.cascos);
    const negro = mate(0x2a2e35, 0.7);
    const arco = sombrear(new THREE.Mesh(geo('arcoCascos', () => new THREE.TorusGeometry(0.122, 0.009, 8, 28, Math.PI)), negro));
    arco.position.y = 0.105; arco.rotation.y = Math.PI / 2; this.cascos.add(arco);
    for (const lado of [-1, 1]) {
      const copa = sombrear(new THREE.Mesh(geo('copaCascos', () => new THREE.CylinderGeometry(0.037, 0.037, 0.03, 16)), negro));
      copa.rotation.z = Math.PI / 2; copa.position.set(0.115 * lado, 0.1, 0); this.cascos.add(copa);
    }
    const brazoMicro = sombrear(new THREE.Mesh(geo('brazoMicro', () => new THREE.CylinderGeometry(0.005, 0.005, 0.11, 6)), negro));
    brazoMicro.position.set(-0.105, 0.06, 0.05); brazoMicro.rotation.set(0.9, 0, 0.5); this.cascos.add(brazoMicro);
    this.cascos.add(en(esfera(0.012, negro), -0.08, 0.03, 0.095));

    // --- Brazos ----------------------------------------------------------------------
    const crearBrazo = (lado) => {
      const hombro = new THREE.Group(); hombro.position.set(0.195 * lado, 0.47, 0); this.spine.add(hombro);
      hombro.add(esfera(0.058, mPrenda));
      if (larga) hombro.add(miembro(0.05, 0.042, 0.3, mPrenda));
      else {
        hombro.add(miembro(0.05, 0.046, 0.14, mPrenda));
        const piel1 = miembro(0.046, 0.041, 0.16, mPiel); piel1.position.y = -0.14; hombro.add(piel1);
      }
      const codo = new THREE.Group(); codo.position.y = -0.3; hombro.add(codo);
      codo.add(esfera(0.042, larga ? mPrenda : mPiel));
      codo.add(miembro(0.04, 0.032, 0.27, larga ? mPrenda : mPiel));
      const muneca = new THREE.Group(); muneca.position.y = -0.27; codo.add(muneca);
      if (larga) { const puno = miembro(0.034, 0.034, 0.03, mPrenda); puno.position.y = 0.012; muneca.add(puno); }
      const palma = esfera(0.038, mPiel, 0.85, 1.3, 0.55); palma.position.y = -0.05; muneca.add(palma);
      const pulgar = esfera(0.014, mPiel, 0.8, 1.4, 0.8); pulgar.position.set(0.026 * lado * -1, -0.04, 0.02); muneca.add(pulgar);
      return { hombro, codo, muneca };
    };
    this.brazoL = crearBrazo(1);
    this.brazoR = crearBrazo(-1);

    // --- Piernas con zapatos ------------------------------------------------------
    const crearPierna = (lado) => {
      const cadera = new THREE.Group(); cadera.position.set(0.09 * lado, -0.02, 0); this.hips.add(cadera);
      cadera.add(miembro(0.078, 0.06, 0.42, mPantalon));
      const rodilla = new THREE.Group(); rodilla.position.y = -0.42; cadera.add(rodilla);
      rodilla.add(esfera(0.06, mPantalon));
      rodilla.add(miembro(0.058, 0.04, 0.4, mPantalon));
      const tobillo = new THREE.Group(); tobillo.position.y = -0.42; rodilla.add(tobillo);
      const calcetin = miembro(0.04, 0.04, 0.03, mPiel); calcetin.position.y = 0.025; tobillo.add(calcetin);
      const zapato = sombrear(new THREE.Mesh(geo('zapato', () => new THREE.BoxGeometry(0.095, 0.06, 0.2)), mZapato));
      zapato.position.set(0, -0.025, 0.04); tobillo.add(zapato);
      const punta = esfera(0.0475, mZapato, 1, 0.65, 1.05); punta.position.set(0, -0.027, 0.135); tobillo.add(punta);
      const suelaM = sombrear(new THREE.Mesh(geo('suela', () => new THREE.BoxGeometry(0.1, 0.018, 0.27)), mSuela));
      suelaM.position.set(0, -0.058, 0.07); tobillo.add(suelaM);
      return { cadera, rodilla, tobillo };
    };
    this.piernaL = crearPierna(1);
    this.piernaR = crearPierna(-1);

    // --- Estado de animación ---------------------------------------------------------
    this.cur = { ...BASE };
    this.tgt = { ...BASE };
    this.capas = { caminar: 0, teclear: 0, hablar: 0 };
    this.capasObjetivo = { caminar: 0, teclear: 0, hablar: 0 };
    this.fase = 0;
    this.reloj = Math.random() * 10;      // para que no respiren ni gesticulen a la vez
    this.cola = [];
    this.yawObjetivo = 0;
    this.llegado = true;
    this.cabezaLider = 0;                 // la cabeza se adelanta al giro del cuerpo
    this.movimientoReducido = false;
  }

  /** Peinados: casquete sobre el cráneo + piezas según el estilo. */
  _pelo(cabeza, estilo, mat) {
    const casquete = sombrear(new THREE.Mesh(
      geo('casquete', () => new THREE.SphereGeometry(0.109, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.47)), mat));
    casquete.position.y = 0.105; casquete.scale.set(0.9, 1.1, 1.0); casquete.rotation.x = -0.36;   // deja ver la frente
    cabeza.add(casquete);
    const mecha = (x, y, z, r, largo, rotX = 0, rotZ = 0) => {
      const m = sombrear(new THREE.Mesh(geo(`mecha${r}/${largo}`, () => new THREE.CapsuleGeometry(r, largo, 4, 10)), mat));
      m.position.set(x, y, z); m.rotation.set(rotX, 0, rotZ); cabeza.add(m); return m;
    };
    if (estilo === 'largo') {                         // melena lisa hasta los hombros
      mecha(0, -0.015, -0.062, 0.088, 0.2).scale.set(1.05, 1, 0.55);
      mecha(0.088, 0.03, -0.01, 0.028, 0.15, 0, 0.05); mecha(-0.088, 0.03, -0.01, 0.028, 0.15, 0, -0.05);
    } else if (estilo === 'coleta') {                 // coleta alta que cae por detrás
      const goma = esfera(0.026, mat); goma.position.set(0, 0.17, -0.085); cabeza.add(goma);
      mecha(0, 0.09, -0.115, 0.03, 0.2, 0.28);
    } else {                                          // corto: patillas y nuca
      mecha(0, 0.05, -0.062, 0.06, 0.02).scale.set(1.2, 0.8, 0.6);
      for (const lado of [-1, 1]) mecha(0.085 * lado, 0.075, 0.0, 0.016, 0.04);
    }
  }

  poner(nombre) { this.tgt = { ...BASE, ...(POSES[nombre] || {}) }; return this; }
  posicion(x, z) { this.root.position.set(x, 0, z); return this; }
  orientar(yaw) { this.yawObjetivo = yaw; return this; }
  mirarA(x, z) { this.yawObjetivo = Math.atan2(x - this.root.position.x, z - this.root.position.z); return this; }
  teletransportarYaw(yaw) { this.yawObjetivo = yaw; this.root.rotation.y = yaw; this.cabezaLider = 0; return this; }

  /** Camina por una lista de puntos [[x,z], ...] a `vel` m/s. */
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
        this.fase += d.vel * dt * 5.4;
      }
    }
    this.capasObjetivo.caminar = andando ? 1 : 0;

    // 2) Giro creíble: primero se adelanta la cabeza y luego el cuerpo (más lento al pararse)
    let dy = this.yawObjetivo - this.root.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.root.rotation.y += dy * (1 - Math.exp(-(andando ? 7 : 4.2) * dt));
    const lider = Math.max(-0.9, Math.min(0.9, dy * 0.75));
    this.cabezaLider += (lider - this.cabezaLider) * (1 - Math.exp(-9 * dt));

    // 3) Acercar ángulos al objetivo (suavizado exponencial) y capas
    const k = 1 - Math.exp(-7 * dt);
    for (const n in this.tgt) this.cur[n] += (this.tgt[n] - this.cur[n]) * k;
    for (const n in this.capas) this.capas[n] += (this.capasObjetivo[n] - this.capas[n]) * k;
    const mr = this.movimientoReducido ? 0.25 : 1;

    const c = this.cur, w = this.capas.caminar, t = this.reloj, ph = this.fase;
    const libres = 1 - Math.min(1, c.bloqueoBrazos);            // 1 = brazos colgando (se balancean al andar)
    const teclear = this.capas.teclear * mr, hablar = this.capas.hablar * mr;

    // --- Tronco ---
    const respira = Math.sin(t * 1.7) * 0.006 * mr;
    this.hips.position.y = c.hipsY + Math.abs(Math.sin(ph)) * 0.028 * w;
    this.hips.position.x = Math.sin(ph) * 0.014 * w;                   // balanceo lateral de la cadera
    this.hips.rotation.y = -Math.sin(ph) * 0.07 * w;
    this.spine.rotation.set(c.spineX + respira + Math.sin(t * 0.9) * 0.012 * hablar, c.spineY + Math.sin(ph) * 0.1 * w + Math.sin(t * 1.3) * 0.03 * hablar, Math.sin(t * 1.1) * 0.02 * hablar);
    this.spine.scale.y = 1 + respira;
    // la cabeza se estabiliza al andar y mira un poco a la pantalla al teclear
    const cabeceo = Math.sin(t * 2.4) * 0.06 * hablar + Math.sin(t * 0.7) * 0.015 * teclear;
    this.head.rotation.set(c.headX + cabeceo, c.headY + this.cabezaLider - this.spine.rotation.y * 0.6,
                           Math.sin(t * 1.4 + 1) * 0.04 * hablar);

    // --- Brazos: balanceo al andar + teclear con las muñecas + gesticular al hablar ---
    const tec = Math.sin(t * 13) * 0.03 * teclear, tec2 = Math.sin(t * 10.5 + 1.3) * 0.03 * teclear;
    const gesto = (Math.sin(t * 3.1) * 0.22 + Math.sin(t * 5.3) * 0.08) * hablar;
    const gestoIzq = Math.sin(t * 2.1 + 2) * 0.05 * hablar;
    const s = Math.sin(ph), s2 = -s;
    this.brazoL.hombro.rotation.set(c.shLx + s2 * 0.6 * w * libres + tec + gestoIzq, 0, c.shLz);
    this.brazoL.codo.rotation.set(c.elLx - (0.18 + Math.max(0, s2) * 0.35) * w * libres + tec2, 0, 0);
    this.brazoL.muneca.rotation.set(Math.sin(t * 17) * 0.16 * teclear, 0, 0);
    this.brazoR.hombro.rotation.set(c.shRx + s * 0.6 * w * libres - gesto * 0.4, 0, c.shRz);
    this.brazoR.codo.rotation.set(c.elRx - (0.18 + Math.max(0, s) * 0.35) * w * libres - gesto, 0, 0);
    this.brazoR.muneca.rotation.set(Math.sin(t * 15 + 2) * 0.16 * teclear + Math.sin(t * 4.2) * 0.25 * hablar, 0, 0);

    // --- Piernas: al andar, cadera adelante/atrás, rodilla que se flexiona al avanzar y pie que acompaña ---
    const hL = Math.sin(ph) * 0.6 * w, hR = -Math.sin(ph) * 0.6 * w;
    const kL = Math.max(0, -Math.cos(ph)) * 0.95 * w, kR = Math.max(0, Math.cos(ph)) * 0.95 * w;
    this.piernaL.cadera.rotation.set(c.hipLx + hL, 0, 0);
    this.piernaL.rodilla.rotation.set(c.kneeLx + kL, 0, 0);
    this.piernaR.cadera.rotation.set(c.hipRx + hR, 0, 0);
    this.piernaR.rodilla.rotation.set(c.kneeRx + kR, 0, 0);
    // el tobillo compensa para que el pie quede casi plano (y se levante la punta al despegar)
    const sentado = c.hipLx < -1;
    this.piernaL.tobillo.rotation.set(sentado ? -0.0 : -(hL + kL) * 0.55 + (kL > 0.3 ? 0.25 : 0), 0, 0);
    this.piernaR.tobillo.rotation.set(sentado ? -0.0 : -(hR + kR) * 0.55 + (kR > 0.3 ? 0.25 : 0), 0, 0);
  }
}
