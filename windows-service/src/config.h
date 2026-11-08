// =============================================================================
//  config.h — Lectura del archivo config.ini
// =============================================================================
//  Formato: líneas "clave = valor". Las líneas que empiezan por ; o # son
//  comentarios y los [encabezados] se ignoran (solo ayudan a leer el archivo).
//  Elegí un .ini propio y simple en lugar de JSON/XML para que una persona sin
//  experiencia lo edite con el Bloc de notas sin romper nada.
// =============================================================================
#pragma once
#include <cstdint>
#include <filesystem>
#include <string>

namespace cartel {

struct Config {
  std::string host = "cartel.local";  // nombre mDNS o IP del ESP32
  std::string host_respaldo;          // IP a probar si el nombre no resuelve
  uint16_t puerto = 80;
  std::string token;                  // debe coincidir con TOKEN_CARTEL del firmware

  uint32_t sondeo_ms = 1000;          // cada cuánto se mira el micrófono
  uint32_t latido_s = 15;             // cada cuánto se repite el estado
  uint32_t retardo_libre_s = 5;       // antirrebote hacia PASAR
  uint32_t reintento_s = 5;           // espera entre intentos tras un fallo
  uint32_t timeout_http_ms = 2000;    // tiempo máximo por petición
};

// Lee `ruta` y rellena `cfg`. Devuelve false si el archivo no existe o hay un
// valor inválido (el mensaje queda en `error`). Las claves que no aparezcan
// conservan su valor por defecto.
bool cargarConfig(const std::filesystem::path& ruta, Config& cfg, std::string& error);

// Igual pero desde texto en memoria (lo usan los tests).
bool interpretarConfig(const std::string& texto, Config& cfg, std::string& error);

}  // namespace cartel
