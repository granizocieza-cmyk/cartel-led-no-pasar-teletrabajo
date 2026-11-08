// Genera, con la lógica real (docs/js/nucleo.js), los fotogramas de una demo corta
// y los escribe como JSON en la salida estándar. Los consume generar_gif.py.
//   Línea de tiempo: arranca -> PASAR -> entra llamada (NO PASAR) -> cuelga -> PASAR
const N = require('../docs/js/nucleo.js');

const FPS = 12;
const DURACION_S = 13;
const eventos = [          // [segundo, estado que llega al cartel, rótulo]
  [0.4, N.LIBRE, 'Micro libre  →  PASAR'],
  [3.8, N.OCUPADO, 'Entra llamada de Teams  →  NO PASAR'],
  [9.2, N.LIBRE, 'Cuelga (espera 5 s)  →  PASAR'],
];

const cartel = new N.Cartel();
const salida = [];
let rotulo = 'Arrancando el cartel…';
let i = 0;
for (let f = 0; f < FPS * DURACION_S; f++) {
  const t = Math.round((f * 1000) / FPS);
  while (i < eventos.length && eventos[i][0] * 1000 <= t) {
    cartel.recibirOrden(eventos[i][1], t, t);
    rotulo = eventos[i][2];
    i++;
  }
  const fr = cartel.fotograma(t, t);
  salida.push({ rotulo, brillo: fr.brillo, px: Array.from(fr.marco) });
}
process.stdout.write(JSON.stringify({ fps: FPS, cuadros: salida }));
