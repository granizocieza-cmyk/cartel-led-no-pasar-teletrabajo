// =============================================================================
//  mic_wasapi.h — ¿Hay algún micrófono en uso?  (solo Windows)
// =============================================================================
//  PRIVACIDAD: este módulo NUNCA abre un flujo de audio, NUNCA llama a
//  IAudioClient::Start ni a IAudioCaptureClient. Solo pregunta a Windows:
//  "¿cuáles de las sesiones de audio de este micro están en estado Activo?".
//  Es la misma información que usa el icono de micrófono de la barra de tareas.
//  Es técnicamente imposible que este código grabe: no contiene ni una
//  llamada que lea muestras de audio.
// =============================================================================
#pragma once
#include <string>
#include <vector>

namespace cartel {

struct LecturaMic {
  bool activo = false;                   // true si alguna sesión de captura está activa
  int dispositivos = 0;                  // cuántos micros activos se han revisado
  std::vector<std::string> aplicaciones; // nombres de los .exe con sesión activa (para el log)
  std::string error;                     // no vacío si algo falló al preguntar a Windows
};

class DetectorMic {
 public:
  DetectorMic();
  ~DetectorMic();
  DetectorMic(const DetectorMic&) = delete;
  DetectorMic& operator=(const DetectorMic&) = delete;

  // Revisa TODOS los dispositivos de captura activos (no solo el
  // predeterminado): así funciona con unos cascos USB/Bluetooth aunque el
  // micro del portátil sea el "predeterminado".
  LecturaMic leer();

 private:
  bool comIniciado_ = false;
};

}  // namespace cartel
