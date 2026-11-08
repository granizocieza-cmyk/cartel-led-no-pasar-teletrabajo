// =============================================================================
//  pantalla.h — "Lienzo" en memoria y primitivas de dibujo
// =============================================================================
//  Dibujo SIEMPRE en un Marco (una copia de la pantalla en RAM) y solo después
//  lo vuelco a la tira de LEDs. Ventajas de separar "dibujar" de "enviar":
//    * puedo mezclar dos fotogramas (la transición entre estados),
//    * puedo medir cuánto consumiría el fotograma ANTES de encender nada,
//    * puedo probar el dibujo en el PC sin tener un ESP32.
// =============================================================================
#pragma once
#include <stdint.h>
#include <math.h>
#include "config.h"
#include "fuente3x5.h"

struct Color {
  uint8_t r, g, b;
};

constexpr Color NEGRO  = {0, 0, 0};
constexpr Color ROJO   = {255, 0, 0};
constexpr Color VERDE  = {0, 255, 0};
constexpr Color AMBAR  = {255, 100, 0};   // estado neutro / "no sé"
constexpr Color CIAN   = {0, 150, 255};   // mensajes de arranque
constexpr Color BLANCO = {255, 255, 255};

// Un fotograma completo. Va dentro de un struct para poder copiarlo con "=".
struct Marco {
  Color p[ALTO][ANCHO];
};

inline void limpiar(Marco& m) {
  for (int y = 0; y < ALTO; y++)
    for (int x = 0; x < ANCHO; x++) m.p[y][x] = NEGRO;
}

inline void poner(Marco& m, int x, int y, Color c) {
  if (x < 0 || x >= ANCHO || y < 0 || y >= ALTO) return;  // recorta lo que se sale
  m.p[y][x] = c;
}

// Multiplica un color por un factor 0..1. El +0.5 redondea al más cercano.
// (Uso double a propósito: da exactamente el mismo resultado que JavaScript,
// y así la simulación web es fiel al píxel.)
inline Color escalar(Color c, double k) {
  if (k < 0) k = 0;
  if (k > 1) k = 1;
  return Color{(uint8_t)(c.r * k + 0.5), (uint8_t)(c.g * k + 0.5), (uint8_t)(c.b * k + 0.5)};
}

// Ancho en píxeles de un texto: letras + 1 píxel de separación entre ellas.
inline int anchoTexto(const char* s) {
  int w = 0;
  for (const char* p = s; *p; p++) {
    w += buscarGlifo(*p).ancho;
    if (*(p + 1)) w += 1;
  }
  return w;
}

// Dibuja texto con su esquina superior izquierda en (x0, y0).
inline void dibujarTexto(Marco& m, const char* s, int x0, int y0, Color c) {
  int x = x0;
  for (const char* p = s; *p; p++) {
    const Glifo& g = buscarGlifo(*p);
    for (int fila = 0; fila < ALTO_FUENTE; fila++) {
      for (int col = 0; col < g.ancho; col++) {
        bool encendido = (g.filas[fila] >> (g.ancho - 1 - col)) & 1;
        if (encendido) poner(m, x + col, y0 + fila, c);
      }
    }
    x += g.ancho + 1;
  }
}
