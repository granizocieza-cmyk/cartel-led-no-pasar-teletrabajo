// =============================================================================
//  test_nucleo.cpp — Pruebas de la lógica del agente con un micrófono SIMULADO
// =============================================================================
//  No hace falta Windows ni micrófono: se inventa el tiempo y las lecturas.
//  Sin frameworks: un par de macros y listo. Si algo falla, el programa
//  termina con código distinto de 0 (así lo detectan CMake/CTest y la CI).
// =============================================================================
#include <cstdio>
#include <string>

#include "../src/config.h"
#include "../src/estado.h"

using namespace cartel;

static int fallos = 0;
#define COMPROBAR(cond)                                                    \
  do {                                                                     \
    if (!(cond)) {                                                         \
      std::printf("  FALLO (línea %d): %s\n", __LINE__, #cond);            \
      fallos++;                                                            \
    }                                                                      \
  } while (0)

// Pequeño "simulador": avanza el reloj de segundo en segundo y registra los envíos.
struct Simulador {
  Decisor d;
  uint64_t t = 0;
  int envios = 0;
  Estado ultimoEnviado = Estado::Desconocido;
  bool red_ok = true;

  explicit Simulador(Tiempos tiempos = Tiempos()) : d(tiempos) {}

  // Avanza `segundos` con el micro en `mic`. Devuelve cuántos envíos hubo.
  int avanzar(int segundos, bool mic) {
    int antes = envios;
    for (int i = 0; i < segundos; i++) {
      t += 1000;
      Accion a = d.tick(t, mic);
      if (a.enviar) {
        envios++;
        ultimoEnviado = a.estado;
        d.resultadoEnvio(red_ok, t);
      }
    }
    return envios - antes;
  }
};

static void prueba(const char* nombre, void (*f)()) {
  int antes = fallos;
  f();
  std::printf("[%s] %s\n", fallos == antes ? " ok " : "FAIL", nombre);
}

static void arranque_libre_envia_libre() {
  Simulador s;
  COMPROBAR(s.avanzar(1, false) == 1);
  COMPROBAR(s.ultimoEnviado == Estado::Libre);
}

static void micro_activo_envia_ocupado_al_instante() {
  Simulador s;
  s.avanzar(3, false);
  COMPROBAR(s.avanzar(1, true) == 1);  // al SEGUNDO que se activa, ya se envía
  COMPROBAR(s.ultimoEnviado == Estado::Ocupado);
}

static void no_reenvia_si_no_cambia() {
  Simulador s;  // latido por defecto 15 s
  s.avanzar(1, true);
  COMPROBAR(s.avanzar(10, true) == 0);  // 10 s con la llamada: silencio
}

static void latido_cada_15s() {
  Simulador s;
  s.avanzar(1, true);                   // t=1: primer envío
  COMPROBAR(s.avanzar(14, true) == 0);  // hasta t=15: nada
  COMPROBAR(s.avanzar(1, true) == 1);   // t=16: latido (15 s tras el éxito)
  COMPROBAR(s.ultimoEnviado == Estado::Ocupado);
}

static void antirrebote_hacia_libre() {
  Simulador s;  // retardo 5 s
  s.avanzar(1, true);
  // Micro apagado: durante 4 s sigue OCUPADO (no se envía nada)...
  COMPROBAR(s.avanzar(4, false) == 0);
  COMPROBAR(s.d.confirmado() == Estado::Ocupado);
  // ...y al llegar a 5 s sin actividad, pasa a LIBRE y se envía.
  COMPROBAR(s.avanzar(1, false) == 1);
  COMPROBAR(s.ultimoEnviado == Estado::Libre);
}

static void micro_que_parpadea_no_cambia_el_cartel() {
  Simulador s;
  s.avanzar(1, true);  // OCUPADO enviado
  int env = 0;
  // 3 s apagado, 1 s encendido, repetido 10 veces: nunca llega a 5 s seguidos.
  for (int i = 0; i < 10; i++) {
    env += s.avanzar(3, false);
    env += s.avanzar(1, true);
  }
  // Solo pueden haber sido latidos (mismo estado OCUPADO), nunca LIBRE.
  COMPROBAR(s.ultimoEnviado == Estado::Ocupado);
  COMPROBAR(env <= 3);  // 40 s => como mucho 2-3 latidos
}

static void vuelve_a_ocupado_sin_esperar() {
  Simulador s;
  s.avanzar(1, true);
  s.avanzar(6, false);  // ya LIBRE
  COMPROBAR(s.ultimoEnviado == Estado::Libre);
  COMPROBAR(s.avanzar(1, true) == 1);  // nueva llamada: inmediato
  COMPROBAR(s.ultimoEnviado == Estado::Ocupado);
}

static void reintenta_tras_fallo_de_red() {
  Simulador s;  // reintento 5 s
  s.red_ok = false;
  COMPROBAR(s.avanzar(1, true) == 1);   // primer intento (falla)
  COMPROBAR(s.avanzar(4, true) == 0);   // no machaca la red antes de 5 s
  COMPROBAR(s.avanzar(1, true) == 1);   // reintento a los 5 s
  s.red_ok = true;
  s.avanzar(5, true);                   // este reintento sí funciona
  COMPROBAR(s.avanzar(10, true) == 0);  // y ya vuelve el silencio
}

static void cambio_nuevo_durante_fallo_se_intenta_enseguida() {
  Simulador s;
  s.red_ok = false;
  s.avanzar(1, false);  // intenta LIBRE (falla)
  COMPROBAR(s.avanzar(1, true) == 1);  // llamada nueva: no espera a reintento_ms
  COMPROBAR(s.ultimoEnviado == Estado::Ocupado);
}

static void config_valida_y_errores() {
  Config c;
  std::string err;
  COMPROBAR(interpretarConfig("; comentario\n[cartel]\nhost = 192.168.1.50\npuerto=8080\nlatido_s = 20\n", c, err));
  COMPROBAR(c.host == "192.168.1.50" && c.puerto == 8080 && c.latido_s == 20);
  COMPROBAR(c.retardo_libre_s == 5);  // lo no escrito conserva su valor por defecto

  Config malo;
  COMPROBAR(!interpretarConfig("puerto = abc\n", malo, err));
  COMPROBAR(!interpretarConfig("latido_s = 0\n", malo, err));          // fuera de rango
  COMPROBAR(!interpretarConfig("inventada = 3\n", malo, err));         // clave desconocida
  COMPROBAR(!interpretarConfig("sin igual\n", malo, err));
}

int main() {
  prueba("arranque con micro libre envía LIBRE", arranque_libre_envia_libre);
  prueba("micro activo envía OCUPADO al instante", micro_activo_envia_ocupado_al_instante);
  prueba("no reenvía si el estado no cambia", no_reenvia_si_no_cambia);
  prueba("latido cada 15 s", latido_cada_15s);
  prueba("antirrebote de 5 s hacia LIBRE", antirrebote_hacia_libre);
  prueba("micro que parpadea no cambia el cartel", micro_que_parpadea_no_cambia_el_cartel);
  prueba("nueva llamada tras LIBRE es inmediata", vuelve_a_ocupado_sin_esperar);
  prueba("reintento tras fallo de red", reintenta_tras_fallo_de_red);
  prueba("cambio durante un fallo se intenta enseguida", cambio_nuevo_durante_fallo_se_intenta_enseguida);
  prueba("config.ini: valores y errores", config_valida_y_errores);

  if (fallos) {
    std::printf("\n%d comprobaciones fallidas\n", fallos);
    return 1;
  }
  std::printf("\nTodo correcto\n");
  return 0;
}
