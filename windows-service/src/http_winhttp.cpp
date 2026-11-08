#include "http_winhttp.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <winhttp.h>

namespace cartel {

namespace {

std::wstring aAncho(const std::string& s) {
  if (s.empty()) return std::wstring();
  int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), nullptr, 0);
  std::wstring w(n, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), &w[0], n);
  return w;
}

// Cierra automáticamente un HINTERNET de WinHTTP.
struct Manejador {
  HINTERNET h;
  explicit Manejador(HINTERNET x) : h(x) {}
  ~Manejador() { if (h) WinHttpCloseHandle(h); }
  Manejador(const Manejador&) = delete;
  Manejador& operator=(const Manejador&) = delete;
};

}  // namespace

bool enviarGet(const std::string& host, uint16_t puerto, const std::string& ruta, uint32_t timeout_ms,
               std::string& detalle) {
  // WINHTTP_ACCESS_TYPE_NO_PROXY: el cartel está en la red local, así que NO
  // paso por el proxy de la empresa/sistema (que no sabría llegar a 192.168.x.x).
  Manejador sesion(WinHttpOpen(L"cartel-agent/1.0", WINHTTP_ACCESS_TYPE_NO_PROXY, WINHTTP_NO_PROXY_NAME,
                               WINHTTP_NO_PROXY_BYPASS, 0));
  if (!sesion.h) { detalle = "WinHttpOpen falló (" + std::to_string(GetLastError()) + ")"; return false; }

  int t = (int)timeout_ms;
  WinHttpSetTimeouts(sesion.h, t, t, t, t);  // resolver, conectar, enviar, recibir

  Manejador conexion(WinHttpConnect(sesion.h, aAncho(host).c_str(), puerto, 0));
  if (!conexion.h) { detalle = "no se pudo preparar la conexión a " + host; return false; }

  Manejador peticion(WinHttpOpenRequest(conexion.h, L"GET", aAncho(ruta).c_str(), nullptr, WINHTTP_NO_REFERER,
                                        WINHTTP_DEFAULT_ACCEPT_TYPES, 0));
  if (!peticion.h) { detalle = "WinHttpOpenRequest falló"; return false; }

  if (!WinHttpSendRequest(peticion.h, WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0) ||
      !WinHttpReceiveResponse(peticion.h, nullptr)) {
    DWORD e = GetLastError();
    // 12007 = no se resolvió el nombre; 12002 = timeout; 12029 = no se pudo conectar.
    detalle = "sin respuesta de " + host + " (error WinHTTP " + std::to_string(e) + ")";
    return false;
  }

  DWORD codigo = 0, tam = sizeof(codigo);
  WinHttpQueryHeaders(peticion.h, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                      WINHTTP_HEADER_NAME_BY_INDEX, &codigo, &tam, WINHTTP_NO_HEADER_INDEX);
  detalle = "HTTP " + std::to_string(codigo);
  return codigo == 200;
}

}  // namespace cartel
