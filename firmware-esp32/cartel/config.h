// =============================================================================
//  config.h — Parámetros del cartel (pines, tamaño, brillo, tiempos)
// =============================================================================
//  Este archivo NO contiene nada de Arduino/ESP32: son solo constantes y una
//  función matemática. Así puedo compilarlo también en el PC (ver
//  /firmware-esp32/pruebas) para comprobar que las animaciones del firmware y
//  las de la simulación web son idénticas.
// =============================================================================
#pragma once
#include <stdint.h>

// ---------------------------------------------------------------- Matriz LED
constexpr uint8_t  PIN_DATOS = 16;   // IO16 -> resistencia 330 ohm -> DIN
constexpr int      ANCHO     = 32;   // columnas
constexpr int      ALTO      = 8;    // filas
constexpr uint16_t NUM_LEDS  = ANCHO * ALTO;   // 256

// Cómo está cableada la tira dentro del panel. Las matrices 8x32 baratas son
// una tira larga doblada en zigzag. Lo más habitual (y lo que asumo) es:
//   * se recorre columna a columna, empezando por la izquierda,
//   * la columna 0 va de arriba a abajo, la 1 de abajo a arriba, etc.
// Si al probar tu panel el texto sale desordenado, cambia este valor:
//   0 = columnas en zigzag   (lo típico en paneles flexibles 8x32)
//   1 = filas progresivas    (todas las filas de izquierda a derecha)
//   2 = filas en zigzag
// En simulación (Wokwi) la matriz virtual numera los píxeles por filas, así que
// ahí uso el orden 1 automáticamente (también cuando no hay secrets.h).
#ifndef MATRIZ_ORDEN
#if defined(SIMULACION) || !__has_include("secrets.h")
#define MATRIZ_ORDEN 1
#else
#define MATRIZ_ORDEN 0
#endif
#endif

// Convierte coordenadas (x = 0..31, y = 0..7; (0,0) = esquina superior
// izquierda) en el número de LED dentro de la tira.
inline uint16_t indiceLed(int x, int y) {
#if MATRIZ_ORDEN == 0
  return x * ALTO + ((x % 2 == 0) ? y : (ALTO - 1 - y));
#elif MATRIZ_ORDEN == 1
  return y * ANCHO + x;
#else
  return y * ANCHO + ((y % 2 == 0) ? x : (ANCHO - 1 - x));
#endif
}

// -------------------------------------------------------- Brillo y consumo
// POR QUÉ limito el brillo: una WS2812B a blanco puro (R+G+B al máximo) gasta
// ~60 mA. 256 LEDs => ~15 A, y la fuente es de 2-3 A. Hay dos protecciones:
//   1) BRILLO_MAX: tope fijo de brillo (0-255), ni siquiera la web lo supera.
//   2) LIMITE_MA : el firmware estima los mA de cada fotograma y, si se pasa
//      del presupuesto, baja el brillo solo para ese fotograma.
// Con BRILLO_MAX = 48, el peor caso (todo blanco) son ~2,9 A y el límite por
// software lo recorta antes. El texto real (rojo, ~60 píxeles) gasta ~0,3 A.
constexpr uint8_t  BRILLO_MAX      = 48;
constexpr uint8_t  BRILLO_INICIAL  = 40;
constexpr uint32_t LIMITE_MA       = 1800;  // presupuesto: deja margen en una fuente de 2 A
constexpr float    MA_POR_CANAL    = 20.0f; // un canal (R, G o B) de una WS2812B a tope
constexpr float    MA_REPOSO_LED   = 1.0f;  // consumo en reposo de cada LED (datasheet ~1 mA)

// ------------------------------------------------------------ Tiempos (ms)
constexpr uint32_t TIMEOUT_LATIDO_MS    = 45000; // sin latido del PC -> estado neutro
constexpr uint32_t DURACION_TRANSICION  = 700;   // barrido entre estados
constexpr uint32_t INTERVALO_FOTOGRAMA  = 33;    // ~30 fps
constexpr uint32_t ESPERA_WIFI_MS       = 20000; // máximo esperando WiFi al arrancar
constexpr uint32_t MS_POR_COLUMNA_SCROLL = 60;   // velocidad del texto de la IP
