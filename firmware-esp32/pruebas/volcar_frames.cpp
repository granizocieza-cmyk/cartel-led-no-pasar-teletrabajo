// =============================================================================
//  volcar_frames.cpp — Vuelca fotogramas del firmware como texto (en el PC)
// =============================================================================
//  Compila las MISMAS animaciones del firmware (animaciones.h) en un programa de
//  consola normal y escribe algunos fotogramas en hexadecimal. El script
//  pruebas/comparar_firmware_web.py hace lo mismo con docs/js/nucleo.js y exige
//  que ambas salidas sean idénticas: así la simulación web no puede "mentir".
//
//  Compilar:  g++ -std=c++17 -I../cartel volcar_frames.cpp -o volcar_frames
// =============================================================================
#include <cstdio>
#include <initializer_list>
#include "animaciones.h"

static void volcar(const char* titulo, const Marco& m, uint8_t brillo) {
  std::printf("== %s ==\n", titulo);
  for (int y = 0; y < ALTO; y++) {
    for (int x = 0; x < ANCHO; x++) std::printf("%02x%02x%02x", m.p[y][x].r, m.p[y][x].g, m.p[y][x].b);
    std::printf("\n");
  }
  uint8_t b = brilloSeguro(m, brillo);
  std::printf("brillo=%d ma=%.2f\n", b, estimarMilis(m, b));
}

int main() {
  const uint32_t tiempos[] = {0, 100, 500, 1234, 5000, 123456};
  char titulo[64];
  Marco m;

  for (uint32_t t : tiempos) {
    dibujarOcupado(m, t); std::snprintf(titulo, sizeof titulo, "ocupado t=%u", t); volcar(titulo, m, 40);
    dibujarLibre(m, t);   std::snprintf(titulo, sizeof titulo, "libre t=%u", t);   volcar(titulo, m, 40);
    dibujarNeutro(m, t);  std::snprintf(titulo, sizeof titulo, "neutro t=%u", t);  volcar(titulo, m, 40);
    dibujarConectando(m, t); std::snprintf(titulo, sizeof titulo, "conectando t=%u", t); volcar(titulo, m, 40);
  }
  for (uint32_t t : {0u, 1000u, 3000u, 6000u}) {
    dibujarScroll(m, "IP 192.168.1.50", t, CIAN);
    std::snprintf(titulo, sizeof titulo, "scroll t=%u", t);
    volcar(titulo, m, 40);
  }
  // Transición a mitad de camino: de NO PASAR a PASAR.
  Marco viejo, nuevo;
  dibujarOcupado(viejo, 1000);
  for (double p : {0.1, 0.5, 0.9}) {
    dibujarLibre(nuevo, 300);
    mezclarTransicion(nuevo, viejo, p);
    std::snprintf(titulo, sizeof titulo, "transicion p=%.1f", p);
    volcar(titulo, nuevo, 40);
  }
  // Limitador: todo blanco a brillo máximo debe recortarse.
  for (int y = 0; y < ALTO; y++)
    for (int x = 0; x < ANCHO; x++) m.p[y][x] = BLANCO;
  volcar("todo blanco", m, 255);
  return 0;
}
