/* =============================================================================
 *  nucleo.js — La "lógica real" del proyecto, escrita en JavaScript
 * =============================================================================
 *  Este archivo es una TRADUCCIÓN FIEL de tres piezas en C++:
 *    - firmware-esp32/cartel/fuente3x5.h + pantalla.h + animaciones.h
 *        -> FUENTE, dibujarTexto, dibujarOcupado/Libre/Neutro, transición, consumo
 *    - firmware-esp32/cartel/cartel.ino
 *        -> clase Cartel (máquina de estados del ESP32)
 *    - windows-service/src/estado.cpp
 *        -> clase Agente (antirrebote y latido del PC)
 *
 *  Así la simulación enseña EXACTAMENTE lo que haría el cartel de verdad.
 *  No toca el DOM ni relojes: recibe el tiempo como parámetro. Por eso lo puede
 *  cargar tanto la página web como Node (pruebas/comparar_firmware_web.py compara
 *  sus fotogramas, píxel a píxel, con los del firmware compilado en el PC).
 * ========================================================================== */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Nucleo = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- Constantes
  const ANCHO = 32, ALTO = 8, NUM_LEDS = ANCHO * ALTO;
  const BRILLO_MAX = 48, BRILLO_INICIAL = 40, LIMITE_MA = 1800;
  const MA_POR_CANAL = 20, MA_REPOSO_LED = 1;
  const TIMEOUT_LATIDO_MS = 45000, DURACION_TRANSICION = 700, MS_POR_COLUMNA_SCROLL = 60;

  const ROJO = [255, 0, 0], VERDE = [0, 255, 0], AMBAR = [255, 100, 0];
  const CIAN = [0, 150, 255], BLANCO = [255, 255, 255];

  const ARRANQUE = 'arrancando', NEUTRO = 'neutro', LIBRE = 'libre', OCUPADO = 'ocupado';

  // ------------------------------------------------------------------- Fuente
  // Igual que fuente3x5.h: cada fila es un número binario, el bit más alto = píxel de la izquierda.
  const FUENTE = {
    ' ': [1, [0b0, 0b0, 0b0, 0b0, 0b0]],
    '.': [1, [0b0, 0b0, 0b0, 0b0, 0b1]],
    '?': [3, [0b111, 0b001, 0b010, 0b000, 0b010]],
    'A': [3, [0b010, 0b101, 0b111, 0b101, 0b101]],
    'C': [3, [0b011, 0b100, 0b100, 0b100, 0b011]],
    'E': [3, [0b111, 0b100, 0b110, 0b100, 0b111]],
    'I': [3, [0b111, 0b010, 0b010, 0b010, 0b111]],
    'N': [4, [0b1001, 0b1101, 0b1011, 0b1001, 0b1001]],
    'O': [3, [0b010, 0b101, 0b101, 0b101, 0b010]],
    'P': [3, [0b110, 0b101, 0b110, 0b100, 0b100]],
    'R': [3, [0b110, 0b101, 0b110, 0b101, 0b101]],
    'S': [3, [0b011, 0b100, 0b010, 0b001, 0b110]],
    '0': [3, [0b111, 0b101, 0b101, 0b101, 0b111]],
    '1': [3, [0b010, 0b110, 0b010, 0b010, 0b111]],
    '2': [3, [0b111, 0b001, 0b111, 0b100, 0b111]],
    '3': [3, [0b111, 0b001, 0b111, 0b001, 0b111]],
    '4': [3, [0b101, 0b101, 0b111, 0b001, 0b001]],
    '5': [3, [0b111, 0b100, 0b111, 0b001, 0b111]],
    '6': [3, [0b111, 0b100, 0b111, 0b101, 0b111]],
    '7': [3, [0b111, 0b001, 0b001, 0b010, 0b010]],
    '8': [3, [0b111, 0b101, 0b111, 0b101, 0b111]],
    '9': [3, [0b111, 0b101, 0b111, 0b001, 0b111]],
  };
  const buscarGlifo = (c) => FUENTE[c] || FUENTE['?'];

  // ------------------------------------------------------------------- Marco
  // Un fotograma = ALTO*ANCHO píxeles [r,g,b] guardados en un array plano.
  const nuevoMarco = () => new Uint8Array(NUM_LEDS * 3);
  const copiarMarco = (m) => Uint8Array.from(m);
  const limpiar = (m) => m.fill(0);
  function poner(m, x, y, c) {
    if (x < 0 || x >= ANCHO || y < 0 || y >= ALTO) return;
    const i = (y * ANCHO + x) * 3;
    m[i] = c[0]; m[i + 1] = c[1]; m[i + 2] = c[2];
  }
  // Igual que escalar() de C++: (uint8_t)(valor*k + 0.5)  ==  floor para positivos.
  function escalar(c, k) {
    if (k < 0) k = 0;
    if (k > 1) k = 1;
    return [Math.floor(c[0] * k + 0.5), Math.floor(c[1] * k + 0.5), Math.floor(c[2] * k + 0.5)];
  }
  function anchoTexto(s) {
    let w = 0;
    for (let i = 0; i < s.length; i++) {
      w += buscarGlifo(s[i])[0];
      if (i < s.length - 1) w += 1;
    }
    return w;
  }
  function dibujarTexto(m, s, x0, y0, c) {
    let x = x0;
    for (const ch of s) {
      const [ancho, filas] = buscarGlifo(ch);
      for (let fila = 0; fila < 5; fila++)
        for (let col = 0; col < ancho; col++)
          if ((filas[fila] >> (ancho - 1 - col)) & 1) poner(m, x + col, y0 + fila, c);
      x += ancho + 1;
    }
  }

  // -------------------------------------------------------------- Animaciones
  const respiracion = (t, periodo, minimo) =>
    minimo + (1 - minimo) * (0.5 + 0.5 * Math.sin((2 * Math.PI * (t % periodo)) / periodo));

  function dibujarOcupado(m, t) {
    limpiar(m);
    const k = respiracion(t, 1600, 0.55);
    dibujarTexto(m, 'NO PASAR', Math.trunc((ANCHO - anchoTexto('NO PASAR')) / 2), 2, escalar(ROJO, k));
    const paso = Math.trunc(t / 80);
    const tenue = escalar(ROJO, 0.30);
    for (let x = 0; x < ANCHO; x++) {
      if ((x + paso) % 8 === 0) poner(m, x, 0, tenue);
      if ((((x - paso) % 8) + 8) % 8 === 0) poner(m, x, 7, tenue);
    }
  }
  function dibujarLibre(m, t) {
    limpiar(m);
    dibujarTexto(m, 'PASAR', Math.trunc((ANCHO - anchoTexto('PASAR')) / 2), 2, escalar(VERDE, respiracion(t, 3200, 0.45)));
  }
  function dibujarNeutro(m, t) {
    limpiar(m);
    dibujarTexto(m, '?', Math.trunc((ANCHO - anchoTexto('?')) / 2), 2, escalar(AMBAR, respiracion(t, 2400, 0.25)));
  }
  function dibujarConectando(m, t) {
    limpiar(m);
    const n = 1 + (Math.trunc(t / 300) % 3);
    for (let i = 0; i < n; i++) dibujarTexto(m, '.', 12 + i * 3, 2, CIAN);
  }
  function dibujarScroll(m, texto, t, c) {
    limpiar(m);
    const x = ANCHO - Math.trunc(t / MS_POR_COLUMNA_SCROLL);
    dibujarTexto(m, texto, x, 2, c);
    return x + anchoTexto(texto) < 0;
  }
  function dibujarEstado(m, e, t) {
    if (e === OCUPADO) dibujarOcupado(m, t);
    else if (e === LIBRE) dibujarLibre(m, t);
    else if (e === NEUTRO) dibujarNeutro(m, t);
    else dibujarConectando(m, t);
  }
  function mezclarTransicion(nuevo, viejo, p) {
    const frente = Math.trunc(p * (ANCHO + 2)) - 1;
    const blanco = escalar(BLANCO, 0.5);
    for (let x = 0; x < ANCHO; x++) {
      for (let y = 0; y < ALTO; y++) {
        const i = (y * ANCHO + x) * 3;
        if (x > frente) { nuevo[i] = viejo[i]; nuevo[i + 1] = viejo[i + 1]; nuevo[i + 2] = viejo[i + 2]; }
        else if (x === frente) { nuevo[i] = blanco[0]; nuevo[i + 1] = blanco[1]; nuevo[i + 2] = blanco[2]; }
      }
    }
  }

  // ---------------------------------------------------------------- Consumo
  function estimarMilis(m, brillo) {
    let suma = 0;
    for (let i = 0; i < m.length; i++) suma += m[i];
    return (suma / 255) * MA_POR_CANAL * (brillo / 255) + NUM_LEDS * MA_REPOSO_LED;
  }
  function brilloSeguro(m, deseado) {
    if (deseado > BRILLO_MAX) deseado = BRILLO_MAX;
    const ma = estimarMilis(m, deseado);
    if (ma <= LIMITE_MA) return deseado;
    const reposo = NUM_LEDS * MA_REPOSO_LED;
    return Math.trunc(deseado * ((LIMITE_MA - reposo) / (ma - reposo)));
  }

  // ===========================================================================
  //  Cartel — la máquina de estados de cartel.ino
  // ===========================================================================
  //  Maneja DOS relojes:
  //    * visual : milisegundos reales; anima el dibujo y la transición.
  //    * lógico : puede ir más rápido (x5, x10) para ver el aviso de "sin
  //               latido" sin esperar 45 s de verdad.
  class Cartel {
    constructor(textoIP) {
      this.textoIP = textoIP || 'IP 192.168.1.50';
      this.brillo = BRILLO_INICIAL;
      this.reiniciar(0, 0);
    }
    reiniciar(visual, logico) {
      this.estado = ARRANQUE;
      this.inicioEstado = visual;
      this.ultimoLatido = logico;
      this.marcoActual = nuevoMarco();
      this.marcoViejo = nuevoMarco();
      this.enTransicion = false;
      this.inicioTransicion = 0;
      this.mostrandoIP = false;
      this.ipMostrada = false;
      this.inicioIP = 0;
      this.milis = 0;
      this.registro = [];   // mensajes tipo puerto serie, que la web puede leer y vaciar
    }
    _log(s) { this.registro.push(s); }

    cambiarEstado(nuevo, visual) {
      if (nuevo === this.estado) return;
      this._log(`[estado] ${this.estado} -> ${nuevo}`);
      this.marcoViejo = copiarMarco(this.marcoActual);
      this.enTransicion = true;
      this.inicioTransicion = visual;
      this.estado = nuevo;
      this.inicioEstado = visual;
    }
    // Llega /ocupado o /libre: también es un latido.
    recibirOrden(nuevo, visual, logico) {
      this.ultimoLatido = logico;
      if (this.estado === ARRANQUE) this.mostrandoIP = false;
      this.cambiarEstado(nuevo, visual);
    }
    // Sin latido durante 45 s => neutro. Devuelve true si acaba de pasar.
    comprobarLatido(visual, logico) {
      if ((this.estado === OCUPADO || this.estado === LIBRE) && logico - this.ultimoLatido > TIMEOUT_LATIDO_MS) {
        this._log('[latido] sin noticias del PC: paso a NEUTRO');
        this.cambiarEstado(NEUTRO, visual);
        return true;
      }
      return false;
    }
    // Devuelve { marco, brillo, ma } del fotograma actual (como fotograma() + mostrar()).
    fotograma(visual, logico) {
      const nuevo = nuevoMarco();
      if (this.estado === ARRANQUE) {
        const t = visual - this.inicioEstado;
        if (!this.mostrandoIP && !this.ipMostrada && t > 1500) {   // "el WiFi ya conectó"
          this.mostrandoIP = true; this.inicioIP = visual; this.ipMostrada = true;
          this._log(`[wifi] conectado, ${this.textoIP}`);
        }
        if (this.mostrandoIP) {
          if (dibujarScroll(nuevo, this.textoIP, visual - this.inicioIP, CIAN)) {
            this.mostrandoIP = false;
            this.cambiarEstado(NEUTRO, visual);
            this.ultimoLatido = logico;
          }
        } else {
          dibujarConectando(nuevo, t);
        }
      } else {
        dibujarEstado(nuevo, this.estado, visual - this.inicioEstado);
      }
      if (this.enTransicion) {
        const p = (visual - this.inicioTransicion) / DURACION_TRANSICION;
        if (p >= 1) this.enTransicion = false;
        else mezclarTransicion(nuevo, this.marcoViejo, p);
      }
      this.marcoActual = copiarMarco(nuevo);
      const b = brilloSeguro(nuevo, this.brillo);
      this.milis = estimarMilis(nuevo, b);
      return { marco: nuevo, brillo: b, ma: this.milis };
    }
    segundosDesdeLatido(logico) { return Math.max(0, (logico - this.ultimoLatido) / 1000); }
  }

  // ===========================================================================
  //  Agente — el cerebro del agente de Windows (windows-service/src/estado.cpp)
  // ===========================================================================
  class Agente {
    constructor(tiempos) {
      this.t = Object.assign({ latido_ms: 15000, retardo_libre_ms: 5000, reintento_ms: 5000 }, tiempos || {});
      this.confirmado = null;           // null = Desconocido
      this.ultimaActividad = 0;
      this.hayIntento = false; this.ultimoIntento = 0; this.estadoUltimoIntento = null;
      this.hayExito = false; this.ultimoExito = 0; this.estadoUltimoExito = null;
    }
    // ¿Cuánto falta para pasar a LIBRE? (null si no hay cuenta atrás)
    restanteLibre(ahora, micActivo) {
      if (this.confirmado !== OCUPADO || micActivo) return null;
      return Math.max(0, this.t.retardo_libre_ms - (ahora - this.ultimaActividad));
    }
    tick(ahora, micActivo) {
      if (micActivo) {
        this.ultimaActividad = ahora;
        this.confirmado = OCUPADO;
      } else if (this.confirmado === null) {
        this.confirmado = LIBRE;
      } else if (this.confirmado === OCUPADO && ahora - this.ultimaActividad >= this.t.retardo_libre_ms) {
        this.confirmado = LIBRE;
      }
      const haCambiado = this.confirmado !== this.estadoUltimoExito;
      const tocaLatido = this.hayExito && ahora - this.ultimoExito >= this.t.latido_ms;
      const puedeIntentar = !this.hayIntento || ahora - this.ultimoIntento >= this.t.reintento_ms ||
        this.confirmado !== this.estadoUltimoIntento;
      if ((haCambiado || tocaLatido) && puedeIntentar) {
        this.hayIntento = true; this.ultimoIntento = ahora; this.estadoUltimoIntento = this.confirmado;
        return { enviar: true, estado: this.confirmado, esLatido: !haCambiado };
      }
      return { enviar: false };
    }
    resultadoEnvio(ok, ahora) {
      if (!ok) return;
      this.hayExito = true; this.ultimoExito = ahora; this.estadoUltimoExito = this.estadoUltimoIntento;
    }
    // Segundos hasta el próximo latido (para la barra de la web).
    hastaLatido(ahora) { return this.hayExito ? Math.max(0, this.t.latido_ms - (ahora - this.ultimoExito)) : null; }
  }

  // ---------------------------------------------------------------- Utilidades
  // Volcado en texto, idéntico al de firmware-esp32/pruebas/volcar_frames.cpp
  function volcarMarco(m) {
    const filas = [];
    for (let y = 0; y < ALTO; y++) {
      let f = '';
      for (let x = 0; x < ANCHO; x++) {
        const i = (y * ANCHO + x) * 3;
        f += [m[i], m[i + 1], m[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
      }
      filas.push(f);
    }
    return filas.join('\n');
  }

  return {
    ANCHO, ALTO, NUM_LEDS, BRILLO_MAX, BRILLO_INICIAL, LIMITE_MA, TIMEOUT_LATIDO_MS, DURACION_TRANSICION,
    ARRANQUE, NEUTRO, LIBRE, OCUPADO, ROJO, VERDE, AMBAR, CIAN, BLANCO, FUENTE,
    nuevoMarco, copiarMarco, anchoTexto, dibujarTexto, escalar, respiracion,
    dibujarOcupado, dibujarLibre, dibujarNeutro, dibujarConectando, dibujarScroll, mezclarTransicion,
    estimarMilis, brilloSeguro, volcarMarco, Cartel, Agente,
  };
});
