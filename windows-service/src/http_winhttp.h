// =============================================================================
//  http_winhttp.h — Petición HTTP GET sencilla con WinHTTP
// =============================================================================
//  POR QUÉ WinHTTP y no una librería externa (libcurl...): viene con Windows,
//  así que el programa no depende de nada y compila con cualquier compilador.
// =============================================================================
#pragma once
#include <cstdint>
#include <string>

namespace cartel {

// Hace GET http://host:puerto/ruta. Devuelve true si el servidor contesta 200.
// En `detalle` deja "HTTP 200" o el motivo del fallo (para el log).
bool enviarGet(const std::string& host, uint16_t puerto, const std::string& ruta, uint32_t timeout_ms,
               std::string& detalle);

}  // namespace cartel
