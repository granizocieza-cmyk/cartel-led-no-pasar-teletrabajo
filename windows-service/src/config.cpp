#include "config.h"

#include <cctype>
#include <fstream>
#include <sstream>

namespace cartel {

namespace {

std::string recortar(const std::string& s) {
  size_t a = 0, b = s.size();
  while (a < b && std::isspace((unsigned char)s[a])) a++;
  while (b > a && std::isspace((unsigned char)s[b - 1])) b--;
  return s.substr(a, b - a);
}

// Convierte "123" en número; falla si hay letras o está fuera de rango.
bool aEntero(const std::string& s, uint32_t minimo, uint32_t maximo, uint32_t& salida) {
  if (s.empty()) return false;
  uint64_t v = 0;
  for (char c : s) {
    if (c < '0' || c > '9') return false;
    v = v * 10 + (c - '0');
    if (v > 0xFFFFFFFFull) return false;
  }
  if (v < minimo || v > maximo) return false;
  salida = (uint32_t)v;
  return true;
}

}  // namespace

bool interpretarConfig(const std::string& texto, Config& cfg, std::string& error) {
  std::istringstream in(texto);
  std::string linea;
  int n = 0;
  while (std::getline(in, linea)) {
    n++;
    linea = recortar(linea);
    if (linea.empty() || linea[0] == ';' || linea[0] == '#' || linea[0] == '[') continue;

    size_t igual = linea.find('=');
    if (igual == std::string::npos) {
      error = "línea " + std::to_string(n) + ": falta el signo '='";
      return false;
    }
    std::string clave = recortar(linea.substr(0, igual));
    std::string valor = recortar(linea.substr(igual + 1));
    uint32_t num = 0;

    auto numero = [&](uint32_t mn, uint32_t mx) {
      if (aEntero(valor, mn, mx, num)) return true;
      error = "línea " + std::to_string(n) + ": '" + clave + "' debe ser un número entre " +
              std::to_string(mn) + " y " + std::to_string(mx);
      return false;
    };

    if (clave == "host") cfg.host = valor;
    else if (clave == "host_respaldo") cfg.host_respaldo = valor;
    else if (clave == "token") cfg.token = valor;
    else if (clave == "puerto") { if (!numero(1, 65535)) return false; cfg.puerto = (uint16_t)num; }
    else if (clave == "sondeo_ms") { if (!numero(100, 60000)) return false; cfg.sondeo_ms = num; }
    else if (clave == "latido_s") { if (!numero(1, 3600)) return false; cfg.latido_s = num; }
    else if (clave == "retardo_libre_s") { if (!numero(0, 600)) return false; cfg.retardo_libre_s = num; }
    else if (clave == "reintento_s") { if (!numero(1, 600)) return false; cfg.reintento_s = num; }
    else if (clave == "timeout_http_ms") { if (!numero(200, 30000)) return false; cfg.timeout_http_ms = num; }
    else {
      error = "línea " + std::to_string(n) + ": clave desconocida '" + clave + "'";
      return false;
    }
  }
  if (cfg.host.empty()) {
    error = "'host' no puede estar vacío";
    return false;
  }
  return true;
}

bool cargarConfig(const std::filesystem::path& ruta, Config& cfg, std::string& error) {
  std::ifstream f(ruta, std::ios::binary);
  if (!f) {
    error = "no se pudo abrir " + ruta.string();
    return false;
  }
  std::ostringstream ss;
  ss << f.rdbuf();
  std::string texto = ss.str();
  // Quita la marca BOM de UTF-8 que a veces añade el Bloc de notas.
  if (texto.size() >= 3 && (unsigned char)texto[0] == 0xEF && (unsigned char)texto[1] == 0xBB &&
      (unsigned char)texto[2] == 0xBF)
    texto.erase(0, 3);
  return interpretarConfig(texto, cfg, error);
}

}  // namespace cartel
