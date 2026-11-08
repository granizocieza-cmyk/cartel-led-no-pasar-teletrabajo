// Vuelca los mismos fotogramas que firmware-esp32/pruebas/volcar_frames.cpp, pero
// con docs/js/nucleo.js. Lo usa comparar_firmware_web.py.
const N = require('../docs/js/nucleo.js');

function volcar(titulo, m, brillo) {
  console.log(`== ${titulo} ==`);
  console.log(N.volcarMarco(m));
  const b = N.brilloSeguro(m, brillo);
  console.log(`brillo=${b} ma=${N.estimarMilis(m, b).toFixed(2)}`);
}

const tiempos = [0, 100, 500, 1234, 5000, 123456];
const m = N.nuevoMarco();
for (const t of tiempos) {
  N.dibujarOcupado(m, t); volcar(`ocupado t=${t}`, m, 40);
  N.dibujarLibre(m, t); volcar(`libre t=${t}`, m, 40);
  N.dibujarNeutro(m, t); volcar(`neutro t=${t}`, m, 40);
  N.dibujarConectando(m, t); volcar(`conectando t=${t}`, m, 40);
}
for (const t of [0, 1000, 3000, 6000]) {
  N.dibujarScroll(m, 'IP 192.168.1.50', t, N.CIAN);
  volcar(`scroll t=${t}`, m, 40);
}
const viejo = N.nuevoMarco();
N.dibujarOcupado(viejo, 1000);
for (const p of [0.1, 0.5, 0.9]) {
  const nuevo = N.nuevoMarco();
  N.dibujarLibre(nuevo, 300);
  N.mezclarTransicion(nuevo, viejo, p);
  volcar(`transicion p=${p.toFixed(1)}`, nuevo, 40);
}
const blanco = N.nuevoMarco().fill(255);
volcar('todo blanco', blanco, 255);
