// =============================================================================
//  estado.h — Cerebro del agente: ¿cuándo hay que avisar al cartel?
// =============================================================================
//  Esta clase NO sabe nada de Windows, de audio ni de red. Solo recibe, una vez
//  por segundo, "¿el micro está activo?" y devuelve "¿hay que enviar algo al
//  cartel y qué?". Al estar aislada se puede probar en cualquier sistema con
//  un micrófono simulado (ver tests/test_nucleo.cpp).
//
//  Reglas (todas configurables):
//    * Micro activo   -> OCUPADO inmediatamente (si alguien llama, el cartel
//                        tiene que avisar YA).
//    * Micro inactivo -> LIBRE solo tras `retardo_libre_ms` seguidos sin
//                        actividad (antirrebote). Así, si el micro se corta
//                        2 segundos al cambiar de cascos, el cartel no parpadea.
//    * Solo se envía cuando CAMBIA el estado, más un "latido" cada
//      `latido_ms` repitiendo el estado actual (para que el cartel sepa que el
//      PC sigue vivo; si el PC se apaga, el cartel pasa a neutro).
//    * Si un envío falla, se reintenta cada `reintento_ms` (sin saturar la red).
// =============================================================================
#pragma once
#include <cstdint>

namespace cartel {

enum class Estado { Desconocido, Libre, Ocupado };

struct Tiempos {
  uint64_t latido_ms = 15000;        // cada cuánto repetir el estado aunque no cambie
  uint64_t retardo_libre_ms = 5000;  // antirrebote antes de pasar a LIBRE
  uint64_t reintento_ms = 5000;      // espera mínima entre intentos tras un fallo
};

struct Accion {
  bool enviar = false;
  Estado estado = Estado::Desconocido;  // qué enviar (solo válido si enviar == true)
};

class Decisor {
 public:
  explicit Decisor(Tiempos t = Tiempos()) : t_(t) {}

  // Llamar con la hora actual (ms, monótona) y la lectura del micro.
  Accion tick(uint64_t ahora_ms, bool micActivo);

  // Después de intentar enviar, avisar de si funcionó.
  void resultadoEnvio(bool ok, uint64_t ahora_ms);

  Estado confirmado() const { return confirmado_; }

 private:
  Tiempos t_;
  Estado confirmado_ = Estado::Desconocido;  // estado "oficial" tras el antirrebote
  uint64_t ultimaActividad_ = 0;             // última lectura con micro activo

  bool hayIntento_ = false;
  uint64_t ultimoIntento_ = 0;
  Estado estadoUltimoIntento_ = Estado::Desconocido;

  bool hayExito_ = false;
  uint64_t ultimoExito_ = 0;
  Estado estadoUltimoExito_ = Estado::Desconocido;
};

const char* nombreEstado(Estado e);

}  // namespace cartel
