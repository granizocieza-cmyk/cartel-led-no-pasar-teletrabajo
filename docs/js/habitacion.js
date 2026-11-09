/* =============================================================================
 *  habitacion.js — La maqueta: habitación, pasillo, puerta, cartel y muebles
 * =============================================================================
 *  Todo es geometría propia (cajas y cilindros); las únicas "texturas" se dibujan
 *  en canvas (tablones, baldosas, pantalla del portátil, LEDs del cartel).
 *  Sin modelos ni imágenes externas => nada que licenciar.
 *
 *  Plano (vista desde arriba, +Z hacia la cámara):
 *
 *        x=-3.0                  x=0 (tabique)            x=1.9
 *   z=-1.9 +----------------------+------------------------+   fondo (alto)
 *          |  escritorio          |                        |
 *          |                      |  PASILLO               |
 *          |   HABITACIÓN         D <- puerta (z -0.6..0.35)|
 *          |                      |                        |
 *   z= 1.9 +----------------------+------------------------+   frente (abierto: corte)
 *
 *  Las paredes del frente no existen (corte tipo casa de muñecas) y el tabique y
 *  la pared derecha son bajos (1,1 m), como en una maqueta arquitectónica: así se
 *  ve el interior y el pasillo a la vez. La puerta sí es de altura completa.
 * ========================================================================== */
import * as THREE from 'three';
import { crearPantalla } from './pantalla_portatil.js';

export const D = {
  xIzq: -3.0, xTabique: 0, xDer: 1.9, zFondo: -1.9, zFrente: 1.9,
  hAlta: 2.5, hBaja: 1.1,
  puertaZ0: -0.6, puertaZ1: 0.35,       // hueco de la puerta; la bisagra está en z = -0.6, junto a la pared del fondo
  anguloAbierta: 1.66,                  // ~95 grados, se abre hacia la habitación
  escritorio: { x: -1.9, z: -1.5 },
  silla: { x: -1.9, z: -0.95 },
};

const mate = (color, rug = 0.95, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rug, metalness: metal });

function texturaCanvas(w, h, pintar, repX = 1, repY = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  pintar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repX, repY);
  t.anisotropy = 8;
  return t;
}

function texturaHalo() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function crearHabitacion() {
  const g = new THREE.Group();
  const caja = (w, h, d, m, x, y, z, padre = g, sombra = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z); mesh.castShadow = sombra; mesh.receiveShadow = true; padre.add(mesh); return mesh;
  };
  const cilindro = (rs, ri, h, m, x, y, z, padre = g, seg = 16) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rs, ri, h, seg), m);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; padre.add(mesh); return mesh;
  };

  // ---------------------------------------------------------------- Materiales
  const pared = mate(0xebe7de), paredFria = mate(0xdde2e8), marco = mate(0xd7d0c1);
  const madera = mate(0xcdb48c, 0.85), maderaOscura = mate(0xa8875f, 0.8);
  const gris = mate(0x3a4048, 0.85), aluminio = mate(0xc6cad1, 0.5, 0.25);
  const zocalo = mate(0x2b3038, 0.9);

  const texSuelo = texturaCanvas(512, 512, (c, w, h) => {
    c.fillStyle = '#c8ab82'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      c.fillStyle = `rgba(${i % 2 ? '255,240,215' : '90,60,30'},${0.05 + (i % 3) * 0.02})`; c.fillRect(0, i * 64, w, 64);
      c.fillStyle = 'rgba(60,40,20,0.35)'; c.fillRect(0, i * 64, w, 2);
      const off = (i * 173) % 256; c.fillRect(off, i * 64, 2, 64); c.fillRect((off + 256) % 512, i * 64, 2, 64);
    }
  }, 3, 4);
  const texPasillo = texturaCanvas(256, 256, (c, w, h) => {
    c.fillStyle = '#a9afb6'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(40,46,56,0.35)'; c.lineWidth = 3;
    c.strokeRect(0, 0, w, h); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
  }, 2, 6);
  const sueloHabitacion = new THREE.MeshStandardMaterial({ map: texSuelo, roughness: 0.9 });
  const sueloPasillo = new THREE.MeshStandardMaterial({ map: texPasillo, roughness: 0.92 });

  // ------------------------------------------------------ Base (plinto de maqueta)
  const anchoTotal = D.xDer - D.xIzq, cx = (D.xIzq + D.xDer) / 2, prof = D.zFrente - D.zFondo;
  caja(anchoTotal + 0.5, 0.16, prof + 0.5, zocalo, cx, -0.08, 0, g, false).receiveShadow = true;
  for (const [mat, x0, x1] of [[sueloHabitacion, D.xIzq, D.xTabique], [sueloPasillo, D.xTabique, D.xDer]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, prof), mat);
    s.rotation.x = -Math.PI / 2; s.position.set((x0 + x1) / 2, 0.002, 0); s.receiveShadow = true; g.add(s);
  }

  // ------------------------------------------------------------------ Paredes
  const e = 0.12;
  caja(anchoTotal + e, D.hAlta, e, pared, cx, D.hAlta / 2, D.zFondo - e / 2);                 // fondo
  caja(e, D.hAlta, prof + e, pared, D.xIzq - e / 2, D.hAlta / 2, -e / 2 * 0);                 // izquierda
  caja(e, D.hBaja, prof, pared, D.xDer + e / 2, D.hBaja / 2, 0);                              // derecha (baja)
  const lA = D.puertaZ0 - D.zFondo, lB = D.zFrente - D.puertaZ1;
  caja(e, D.hBaja, lA, pared, D.xTabique, D.hBaja / 2, D.zFondo + lA / 2);                    // tabique A
  caja(e, D.hBaja, lB, pared, D.xTabique, D.hBaja / 2, D.puertaZ1 + lB / 2);                  // tabique B
  // franja más fría en la parte del pasillo (sobre la pared del fondo)
  caja(D.xDer - D.xTabique, D.hAlta - 0.02, 0.01, paredFria, (D.xTabique + D.xDer) / 2, D.hAlta / 2, D.zFondo + 0.005, g, false);

  // -------------------------------------------------------------- Marco de la puerta
  const zc = (D.puertaZ0 + D.puertaZ1) / 2, ancho = D.puertaZ1 - D.puertaZ0;
  caja(0.15, 2.15, 0.1, marco, 0, 1.075, D.puertaZ0 - 0.05);
  caja(0.15, 2.15, 0.1, marco, 0, 1.075, D.puertaZ1 + 0.05);
  caja(0.15, 0.13, ancho + 0.2, marco, 0, 2.09, zc);

  // ------------------------------------------------------------------- La puerta
  const pivote = new THREE.Group(); pivote.position.set(0, 0, D.puertaZ0); g.add(pivote);
  caja(0.05, 2.0, ancho, maderaOscura, 0, 1.0, ancho / 2, pivote);
  const panel = mate(0x987a52, 0.85);
  for (const cara of [1, -1]) {
    caja(0.012, 0.8, 0.62, panel, 0.028 * cara, 1.45, ancho / 2, pivote, false);
    caja(0.012, 0.8, 0.62, panel, 0.028 * cara, 0.55, ancho / 2, pivote, false);
    const pomo = cilindro(0.025, 0.025, 0.07, mate(0xb8a47a, 0.4, 0.6), 0.06 * cara, 1.0, ancho - 0.1, pivote, 14);
    pomo.rotation.z = Math.PI / 2;
  }

  // ----------------------------------------------------- El CARTEL (en la cara del pasillo)
  const carteles = new THREE.Group(); carteles.position.set(0.0, 1.55, ancho / 2); pivote.add(carteles);
  caja(0.04, 0.25, 0.9, mate(0x0b0c10, 0.6), 0.045, 0, 0, carteles, true);          // carcasa
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const panelLed = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.21),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  panelLed.rotation.y = Math.PI / 2; panelLed.position.set(0.0655, 0, 0); carteles.add(panelLed);
  const texHalo = texturaHalo();
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.7),
    new THREE.MeshBasicMaterial({ map: texHalo, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.rotation.y = Math.PI / 2; halo.position.set(0.067, 0, 0); carteles.add(halo);
  const luzCartel = new THREE.PointLight(0xff3b3b, 0, 2.8, 1.8); luzCartel.position.set(0.45, 0, 0); carteles.add(luzCartel);
  // caja del ESP32 sobre el cartel (con su LED de vida)
  caja(0.035, 0.09, 0.16, mate(0xe9ecef, 0.6), 0.045, 0.2, 0.2, carteles);
  const ledEsp = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2fe370, toneMapped: false }));
  ledEsp.position.set(0.066, 0.215, 0.17); carteles.add(ledEsp);

  // Mancha de luz del cartel sobre el suelo del pasillo
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.7),
    new THREE.MeshBasicMaterial({ map: texHalo, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.set(0.85, 0.006, zc); g.add(suelo);

  // ------------------------------------------------------------ Escritorio y silla
  const { escritorio: es, silla: si } = D;
  caja(1.5, 0.04, 0.7, madera, es.x, 0.72, es.z);
  for (const dx of [-0.7, 0.7]) for (const dz of [-0.3, 0.3]) caja(0.045, 0.7, 0.045, mate(0x2f343c), es.x + dx, 0.35, es.z + dz);
  caja(1.7, 0.012, 1.2, mate(0x5a6577, 1), es.x, 0.006, (es.z + si.z) / 2 + 0.05, g, false);   // alfombra
  caja(0.46, 0.05, 0.46, gris, si.x, 0.38, si.z);
  caja(0.44, 0.46, 0.05, gris, si.x, 0.66, si.z + 0.25);
  cilindro(0.03, 0.03, 0.34, mate(0x20242a), si.x, 0.19, si.z);
  cilindro(0.24, 0.24, 0.03, mate(0x20242a), si.x, 0.03, si.z, g, 5);

  // Portátil
  caja(0.34, 0.014, 0.23, aluminio, es.x, 0.747, es.z);
  const bisagra = new THREE.Group(); bisagra.position.set(es.x, 0.754, es.z - 0.115); bisagra.rotation.x = -0.22; g.add(bisagra);
  caja(0.34, 0.22, 0.008, aluminio, 0, 0.11, 0, bisagra);
  const pantalla = crearPantalla(THREE);
  const mallaPantalla = new THREE.Mesh(new THREE.PlaneGeometry(0.315, 0.197),
    new THREE.MeshBasicMaterial({ map: pantalla.textura, toneMapped: false }));
  mallaPantalla.position.set(0, 0.115, 0.0045); bisagra.add(mallaPantalla);
  const luzPantalla = new THREE.PointLight(0x9fc4ff, 0, 1.6, 2); luzPantalla.position.set(es.x, 0.95, es.z + 0.35); g.add(luzPantalla);

  // Detalles del escritorio: taza, libros, planta
  cilindro(0.04, 0.035, 0.09, mate(0xe9ecef, 0.6), es.x + 0.55, 0.785, es.z + 0.12, g, 16);
  caja(0.2, 0.035, 0.15, mate(0x6a7b94), es.x - 0.55, 0.7575, es.z - 0.15);
  caja(0.19, 0.03, 0.14, mate(0xb7a58a), es.x - 0.55, 0.79, es.z - 0.15);
  cilindro(0.06, 0.045, 0.1, mate(0xc8c2b6), es.x + 0.62, 0.79, es.z - 0.22, g, 14);
  const hoja = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), mate(0x8a9d84)); hoja.position.set(es.x + 0.62, 0.9, es.z - 0.22);
  hoja.castShadow = true; g.add(hoja);

  // Ventana y estantería (pared izquierda)
  caja(0.04, 1.0, 1.1, marco, D.xIzq + 0.02, 1.5, -0.9);
  const cristal = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.9), new THREE.MeshBasicMaterial({ color: 0xcfe0ee, toneMapped: false }));
  cristal.rotation.y = Math.PI / 2; cristal.position.set(D.xIzq + 0.045, 1.5, -0.9); g.add(cristal);
  caja(0.05, 0.9, 0.025, marco, D.xIzq + 0.05, 1.5, -0.9, g, false);
  caja(0.05, 0.025, 1.0, marco, D.xIzq + 0.05, 1.5, -0.9, g, false);
  caja(0.3, 1.5, 0.9, madera, D.xIzq + 0.17, 0.75, 0.65);
  const lomos = [0x6a7b94, 0xb7a58a, 0x8a9d84, 0xa5aab3, 0x5a6577, 0xd0c5b0];
  for (let b = 0; b < 3; b++) for (let k = 0; k < 6; k++)
    caja(0.2, 0.22 + (k % 3) * 0.03, 0.09, mate(lomos[(k + b) % lomos.length]), D.xIzq + 0.2, 0.2 + b * 0.45 + 0.12, 0.28 + k * 0.12);

  // Pasillo: banco y cuadro
  caja(0.45, 0.05, 1.0, madera, 1.58, 0.42, -1.3);
  for (const dz of [-0.4, 0.4]) caja(0.4, 0.4, 0.04, mate(0x2f343c), 1.58, 0.2, -1.3 + dz);
  caja(0.62, 0.46, 0.02, mate(0xf2f0ea), 1.1, 1.45, D.zFondo + 0.02, g, false);
  caja(0.5, 0.34, 0.01, mate(0x7d8ca3), 1.1, 1.45, D.zFondo + 0.035, g, false);

  // --------------------------------------------------------------------- Luces
  const hemi = new THREE.HemisphereLight(0xdfe6ee, 0x8b8579, 1.15); g.add(hemi);
  const sol = new THREE.DirectionalLight(0xfff1de, 2.1);
  sol.position.set(-3.5, 6.5, 5); sol.target.position.set(-0.5, 0, 0);
  sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 });
  sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.025; sol.shadow.radius = 4;
  g.add(sol, sol.target);
  const lucesInterior = new THREE.PointLight(0xffe2b8, 4, 6, 2); lucesInterior.position.set(-1.8, 2.2, -0.2); g.add(lucesInterior);
  const lucesPasillo = new THREE.PointLight(0xcfe0ff, 3, 6, 2); lucesPasillo.position.set(1.0, 2.2, 0.4); g.add(lucesPasillo);

  return {
    grupo: g, D,
    puerta: { pivote, abrir(f) { pivote.rotation.y = -f * D.anguloAbierta; } },
    cartel: { canvas: cv, textura: tex, halo, luz: luzCartel, suelo, ledEsp, grupo: carteles },
    portatil: { pantalla, luz: luzPantalla, mallaPantalla },
  };
}
