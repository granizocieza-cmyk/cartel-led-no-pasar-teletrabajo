// =============================================================================
//  animaciones.h — Qué se dibuja en cada estado (funciones puras)
// =============================================================================
//  Cada función recibe un Marco y el tiempo "t" (milisegundos) y lo rellena.
//  No lee relojes ni toca hardware: mismo "t" => mismo dibujo. Eso permite
//  comprobar que la simulación web (docs/js/nucleo.js) dibuja lo mismo.
// =============================================================================
#pragma once
#include "pantalla.h"

enum Estado : uint8_t {
  ARRANQUE,   // arrancando / conectando al WiFi / mostrando la IP
  NEUTRO,     // no sé qué pasa (sin latido del PC): "?" ámbar tenue
  LIBRE,      // micro inactivo: "PASAR" en verde
  OCUPADO     // micro activo:   "NO PASAR" en rojo
};

constexpr double DOS_PI = 6.283185307179586;

// "Respiración": oscila suavemente entre `minimo` y 1.0 con el periodo dado.
// Se usa (t % periodo) para que el número no crezca sin límite y los decimales
// no pierdan precisión tras días encendido.
inline double respiracion(uint32_t t, uint32_t periodo, double minimo) {
  double s = 0.5 + 0.5 * sin(DOS_PI * (double)(t % periodo) / (double)periodo);
  return minimo + (1.0 - minimo) * s;
}

// ------------------------------------------------------------- NO PASAR
// Texto rojo que "late" despacio + dos hileras de puntitos que corren por el
// borde superior (a la derecha) e inferior (a la izquierda): llama la atención
// sin ser un parpadeo molesto en una videollamada.
inline void dibujarOcupado(Marco& m, uint32_t t) {
  limpiar(m);
  double k = respiracion(t, 1600, 0.55);
  dibujarTexto(m, "NO PASAR", (ANCHO - anchoTexto("NO PASAR")) / 2, 2, escalar(ROJO, k));

  int paso = (int)(t / 80);
  Color tenue = escalar(ROJO, 0.30);
  for (int x = 0; x < ANCHO; x++) {
    if (((x + paso) % 8) == 0) poner(m, x, 0, tenue);
    if ((((x - paso) % 8) + 8) % 8 == 0) poner(m, x, 7, tenue);
  }
}

// ----------------------------------------------------------------- PASAR
// Texto verde fijo, con una respiración más lenta (transmite calma).
inline void dibujarLibre(Marco& m, uint32_t t) {
  limpiar(m);
  double k = respiracion(t, 3200, 0.45);
  dibujarTexto(m, "PASAR", (ANCHO - anchoTexto("PASAR")) / 2, 2, escalar(VERDE, k));
}

// --------------------------------------------------------------- NEUTRO
// Un "?" ámbar muy tenue: "no tengo información del PC". Es distinto a rojo y
// a verde para que nadie confíe en un cartel que ha perdido la conexión.
inline void dibujarNeutro(Marco& m, uint32_t t) {
  limpiar(m);
  double k = respiracion(t, 2400, 0.25);
  dibujarTexto(m, "?", (ANCHO - anchoTexto("?")) / 2, 2, escalar(AMBAR, k));
}

// ------------------------------------------------- ARRANQUE: conectando
// De uno a tres puntos cian que se van añadiendo mientras busca el WiFi.
inline void dibujarConectando(Marco& m, uint32_t t) {
  limpiar(m);
  int n = 1 + (int)((t / 300) % 3);
  for (int i = 0; i < n; i++) dibujarTexto(m, ".", 12 + i * 3, 2, CIAN);
}

// ----------------------------------------------- ARRANQUE: texto con scroll
// Desplaza un texto de derecha a izquierda. Devuelve true cuando ya ha salido
// entero por la izquierda (para saber cuándo terminar el arranque).
inline bool dibujarScroll(Marco& m, const char* texto, uint32_t t, Color c) {
  limpiar(m);
  int x = ANCHO - (int)(t / MS_POR_COLUMNA_SCROLL);
  dibujarTexto(m, texto, x, 2, c);
  return (x + anchoTexto(texto)) < 0;
}

inline void dibujarEstado(Marco& m, Estado e, uint32_t t) {
  switch (e) {
    case OCUPADO: dibujarOcupado(m, t); break;
    case LIBRE:   dibujarLibre(m, t);   break;
    case NEUTRO:  dibujarNeutro(m, t);  break;
    default:      dibujarConectando(m, t); break;
  }
}

// ------------------------------------------------------------ Transición
// Barrido de izquierda a derecha: detrás del "frente" (una columna blanca
// tenue) se ve el estado nuevo; delante, todavía el anterior. `p` va de 0 a 1.
// `nuevo` ya contiene el dibujo del estado nuevo; `viejo` es el último
// fotograma que se estaba mostrando (así, si llega otro cambio a mitad de
// barrido, el nuevo barrido parte de lo que se veía y no hay saltos).
inline void mezclarTransicion(Marco& nuevo, const Marco& viejo, double p) {
  int frente = (int)(p * (ANCHO + 2)) - 1;
  for (int x = 0; x < ANCHO; x++) {
    for (int y = 0; y < ALTO; y++) {
      if (x > frente)       nuevo.p[y][x] = viejo.p[y][x];
      else if (x == frente) nuevo.p[y][x] = escalar(BLANCO, 0.5);
    }
  }
}

// ------------------------------------------------------ Consumo estimado
// Estima los mA que pediría el fotograma al brillo dado (0-255).
// Modelo: cada canal encendido al 100% gasta MA_POR_CANAL, proporcional al
// valor del canal y al brillo, más el consumo en reposo de cada LED.
inline double estimarMilis(const Marco& m, uint8_t brillo) {
  double suma = 0;  // suma de todos los canales (0..255 cada uno)
  for (int y = 0; y < ALTO; y++)
    for (int x = 0; x < ANCHO; x++) suma += m.p[y][x].r + m.p[y][x].g + m.p[y][x].b;
  return suma / 255.0 * MA_POR_CANAL * (brillo / 255.0) + NUM_LEDS * MA_REPOSO_LED;
}

// Brillo que realmente se puede usar sin pasar de LIMITE_MA.
inline uint8_t brilloSeguro(const Marco& m, uint8_t brilloDeseado) {
  if (brilloDeseado > BRILLO_MAX) brilloDeseado = BRILLO_MAX;
  double ma = estimarMilis(m, brilloDeseado);
  if (ma <= LIMITE_MA) return brilloDeseado;
  double reposo = NUM_LEDS * MA_REPOSO_LED;
  double factor = (LIMITE_MA - reposo) / (ma - reposo);   // < 1
  return (uint8_t)(brilloDeseado * factor);
}
