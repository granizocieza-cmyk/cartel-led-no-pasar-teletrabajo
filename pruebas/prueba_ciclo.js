// =============================================================================
//  prueba_ciclo.js — Prueba de extremo a extremo SIN navegador (solo Node.js)
// =============================================================================
//  Conecta el Agente (PC) con el Cartel (ESP32) con un reloj inventado y una
//  "red" que podemos cortar, y comprueba el ciclo completo:
//     llamada -> NO PASAR -> colgar -> (antirrebote) -> PASAR -> WiFi caído -> "?"
//
//  Ejecutar:   node pruebas/prueba_ciclo.js
// =============================================================================
const N = require('../docs/js/nucleo.js');
const assert = require('assert');

const VIAJE_MS = 100;   // lo que tarda "la red" en llevar una petición
let ahora = 0;          // reloj único (visual = lógico en esta prueba)
let micActivo = false;
let redOk = true;
const agente = new N.Agente();
const cartel = new N.Cartel();
const enVuelo = [];     // peticiones viajando por la red
const envios = [];

function avanzar(segundos) {
  const fin = ahora + segundos * 1000;
  while (ahora < fin) {
    ahora += 50;                                                    // fotogramas de 50 ms
    if (ahora % 1000 === 0) {                                       // el agente mira el micro cada 1 s
      const a = agente.tick(ahora, micActivo);
      if (a.enviar) {
        agente.resultadoEnvio(redOk, ahora);
        envios.push({ t: ahora, estado: a.estado, ok: redOk, latido: a.esLatido });
        if (redOk) enVuelo.push({ llega: ahora + VIAJE_MS, estado: a.estado });
      }
    }
    for (let i = enVuelo.length - 1; i >= 0; i--) {
      if (enVuelo[i].llega <= ahora) { cartel.recibirOrden(enVuelo[i].estado, ahora, ahora); enVuelo.splice(i, 1); }
    }
    cartel.comprobarLatido(ahora, ahora);
    cartel.fotograma(ahora, ahora);
  }
}

// 1. Arranque: sin micro -> PASAR
avanzar(3);
assert.strictEqual(cartel.estado, N.LIBRE, 'tras arrancar con el micro libre debe poner PASAR');

// 2. Entra una llamada -> NO PASAR en menos de 2 s
micActivo = true;
avanzar(2);
assert.strictEqual(cartel.estado, N.OCUPADO, 'con el micro activo debe poner NO PASAR');

// 3. Latidos durante la llamada: el cartel NO pasa a neutro aunque pasen 2 minutos
avanzar(120);
assert.strictEqual(cartel.estado, N.OCUPADO, 'con latidos regulares no debe pasar a neutro');
const latidos = envios.filter((e) => e.latido).length;
assert.ok(latidos >= 7 && latidos <= 9, `esperaba ~8 latidos en 120 s, hubo ${latidos}`);

// 4. Micro que parpadea (3 s apagado, 1 s encendido): no debe mostrar PASAR
for (let i = 0; i < 6; i++) { micActivo = false; avanzar(3); micActivo = true; avanzar(1); }
assert.strictEqual(cartel.estado, N.OCUPADO, 'el antirrebote debe evitar el parpadeo hacia PASAR');

// 5. Cuelga: sigue en NO PASAR 4 s, y pasa a PASAR a los ~5 s + viaje
micActivo = false;
avanzar(4);
assert.strictEqual(cartel.estado, N.OCUPADO, 'antes de 5 s sin micro sigue en NO PASAR');
avanzar(3);
assert.strictEqual(cartel.estado, N.LIBRE, 'pasados 5 s sin micro debe poner PASAR');

// 6. Se cae el WiFi con una llamada en marcha: tras 45 s sin latido -> neutro
micActivo = true;
avanzar(2);
assert.strictEqual(cartel.estado, N.OCUPADO);
redOk = false;
avanzar(40);
assert.strictEqual(cartel.estado, N.OCUPADO, 'a los 40 s sin latido aún no debe haber pasado a neutro');
avanzar(10);
assert.strictEqual(cartel.estado, N.NEUTRO, 'a los 45+ s sin latido debe mostrar el estado neutro (?)');

// 7. Vuelve el WiFi: el agente reintenta y el cartel se recupera
redOk = true;
avanzar(8);
assert.strictEqual(cartel.estado, N.OCUPADO, 'al volver el WiFi el cartel debe recuperar NO PASAR');

// 8. Consumo: ningún fotograma supera el límite
for (const e of [N.OCUPADO, N.LIBRE, N.NEUTRO]) {
  const m = N.nuevoMarco();
  ({ [N.OCUPADO]: N.dibujarOcupado, [N.LIBRE]: N.dibujarLibre, [N.NEUTRO]: N.dibujarNeutro })[e](m, 0);
  const ma = N.estimarMilis(m, N.brilloSeguro(m, N.BRILLO_INICIAL));
  assert.ok(ma < 600, `${e}: consumo inesperadamente alto (${ma.toFixed(0)} mA)`);
}
const blanco = N.nuevoMarco().fill(255);
assert.ok(N.estimarMilis(blanco, N.brilloSeguro(blanco, 255)) <= N.LIMITE_MA + 1, 'el limitador debe recortar el blanco total');

console.log('OK: ciclo completo llamada -> NO PASAR -> PASAR -> sin señal -> recuperación');
