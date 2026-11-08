// =============================================================================
//  fuente3x5.h — Fuente de píxeles compacta (3 de ancho x 5 de alto)
// =============================================================================
//  POR QUÉ una fuente propia: la matriz mide 32x8. Con una fuente normal de 5x7,
//  "NO PASAR" mediría ~47 píxeles y habría que hacer scroll. Con esta fuente
//  de 3x5 (la N ocupa 4) mide 30 píxeles: CABE FIJO, sin scroll, y se lee de un
//  vistazo al pasar delante de la puerta. Por eso no hay scroll en el cartel.
//
//  Cada letra son 5 filas; cada fila es un número binario donde el bit más a la
//  izquierda del dibujo es el bit más alto. Ejemplo, la "A" (ancho 3):
//      0b010  ->  .#.
//      0b101  ->  #.#
//      0b111  ->  ###
//      0b101  ->  #.#
//      0b101  ->  #.#
//
//  ¡Esta tabla está duplicada en docs/js/nucleo.js! Si cambias una letra aquí,
//  cámbiala allí también (el script pruebas/comparar_firmware_web.py avisa).
// =============================================================================
#pragma once
#include <stdint.h>

struct Glifo {
  char    c;
  uint8_t ancho;
  uint8_t filas[5];
};

constexpr int ALTO_FUENTE = 5;

static const Glifo FUENTE[] = {
  {' ', 1, {0b0, 0b0, 0b0, 0b0, 0b0}},
  {'.', 1, {0b0, 0b0, 0b0, 0b0, 0b1}},
  {'?', 3, {0b111, 0b001, 0b010, 0b000, 0b010}},
  {'A', 3, {0b010, 0b101, 0b111, 0b101, 0b101}},
  {'C', 3, {0b011, 0b100, 0b100, 0b100, 0b011}},
  {'E', 3, {0b111, 0b100, 0b110, 0b100, 0b111}},
  {'I', 3, {0b111, 0b010, 0b010, 0b010, 0b111}},
  {'N', 4, {0b1001, 0b1101, 0b1011, 0b1001, 0b1001}},
  {'O', 3, {0b010, 0b101, 0b101, 0b101, 0b010}},   // redonda; el cero (abajo) es cuadrado
  {'P', 3, {0b110, 0b101, 0b110, 0b100, 0b100}},
  {'R', 3, {0b110, 0b101, 0b110, 0b101, 0b101}},
  {'S', 3, {0b011, 0b100, 0b010, 0b001, 0b110}},
  {'0', 3, {0b111, 0b101, 0b101, 0b101, 0b111}},
  {'1', 3, {0b010, 0b110, 0b010, 0b010, 0b111}},
  {'2', 3, {0b111, 0b001, 0b111, 0b100, 0b111}},
  {'3', 3, {0b111, 0b001, 0b111, 0b001, 0b111}},
  {'4', 3, {0b101, 0b101, 0b111, 0b001, 0b001}},
  {'5', 3, {0b111, 0b100, 0b111, 0b001, 0b111}},
  {'6', 3, {0b111, 0b100, 0b111, 0b101, 0b111}},
  {'7', 3, {0b111, 0b001, 0b001, 0b010, 0b010}},
  {'8', 3, {0b111, 0b101, 0b111, 0b101, 0b111}},
  {'9', 3, {0b111, 0b101, 0b111, 0b001, 0b111}},
};
constexpr int NUM_GLIFOS = sizeof(FUENTE) / sizeof(FUENTE[0]);

// Busca el dibujo de un carácter. Si no existe, devuelve el de '?'.
inline const Glifo& buscarGlifo(char c) {
  for (int i = 0; i < NUM_GLIFOS; i++) {
    if (FUENTE[i].c == c) return FUENTE[i];
  }
  return FUENTE[2];  // '?'
}
