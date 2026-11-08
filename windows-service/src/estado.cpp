#include "estado.h"

namespace cartel {

const char* nombreEstado(Estado e) {
  switch (e) {
    case Estado::Libre: return "libre";
    case Estado::Ocupado: return "ocupado";
    default: return "desconocido";
  }
}

Accion Decisor::tick(uint64_t ahora, bool micActivo) {
  // --- 1. Antirrebote: decidir el estado "oficial" -------------------------
  if (micActivo) {
    ultimaActividad_ = ahora;
    confirmado_ = Estado::Ocupado;  // pasar a OCUPADO no espera nada
  } else if (confirmado_ == Estado::Desconocido) {
    // Primera lectura y el micro está libre: no hay llamada que "enfriar".
    confirmado_ = Estado::Libre;
  } else if (confirmado_ == Estado::Ocupado && ahora - ultimaActividad_ >= t_.retardo_libre_ms) {
    confirmado_ = Estado::Libre;  // llevamos retardo_libre_ms sin actividad
  }

  // --- 2. ¿Toca enviar? ----------------------------------------------------
  bool haCambiado = (confirmado_ != estadoUltimoExito_);          // el cartel no sabe aún este estado
  bool tocaLatido = hayExito_ && (ahora - ultimoExito_ >= t_.latido_ms);
  // Evita martillear la red tras un fallo, pero un cambio de estado nuevo
  // se intenta enseguida aunque el intento anterior fuera hace poco.
  bool puedeIntentar = !hayIntento_ || (ahora - ultimoIntento_ >= t_.reintento_ms) ||
                       (confirmado_ != estadoUltimoIntento_);

  Accion a;
  if ((haCambiado || tocaLatido) && puedeIntentar) {
    a.enviar = true;
    a.estado = confirmado_;
    hayIntento_ = true;
    ultimoIntento_ = ahora;
    estadoUltimoIntento_ = confirmado_;
  }
  return a;
}

void Decisor::resultadoEnvio(bool ok, uint64_t ahora) {
  if (!ok) return;  // el reintento lo gestiona tick() con reintento_ms
  hayExito_ = true;
  ultimoExito_ = ahora;
  estadoUltimoExito_ = estadoUltimoIntento_;
}

}  // namespace cartel
