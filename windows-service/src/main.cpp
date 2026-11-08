// =============================================================================
//  main.cpp — cartel-agent: vigila el micrófono y avisa al cartel LED
// =============================================================================
//  Es un programa normal de Windows SIN ventana (subsistema "windows"), no un
//  "servicio de Windows" del SCM. POR QUÉ: los servicios corren en una sesión
//  aislada (la 0) desde donde WASAPI no ve de forma fiable las sesiones de audio
//  del usuario conectado. Además un programa de usuario no pide permisos de
//  administrador, que es lo más fácil de conseguir en un portátil de empresa.
//  Se arranca solo al iniciar sesión con scripts/instalar-arranque.ps1.
//
//  Uso (todo opcional):
//    cartel-agent.exe                    arranca en segundo plano
//    cartel-agent.exe --consola          igual, pero escribiendo el log en esta consola
//    cartel-agent.exe --estado           dice si el micro está en uso, una vez, y sale
//    cartel-agent.exe --parar            pide a la copia en marcha que termine
//    cartel-agent.exe --config RUTA      usa otro config.ini
//    cartel-agent.exe --micro-falso F    (pruebas) lee el micro de un archivo con 0/1
// =============================================================================
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>

#include <cctype>
#include <cstdio>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

#include "config.h"
#include "estado.h"
#include "http_winhttp.h"
#include "mic_wasapi.h"

namespace fs = std::filesystem;
using namespace cartel;

namespace {

// Nombres de objetos globales del sistema (por sesión de usuario: "Local\").
const wchar_t* NOMBRE_MUTEX = L"Local\\CartelAgentUnicaInstancia";
const wchar_t* NOMBRE_EVENTO_PARAR = L"Local\\CartelAgentParar";

// ---------------------------------------------------------------- Registro
class Registro {
 public:
  void iniciar(bool aConsola) {
    consola_ = aConsola;
    wchar_t base[MAX_PATH] = {};
    if (SUCCEEDED(SHGetFolderPathW(nullptr, CSIDL_LOCAL_APPDATA, nullptr, 0, base))) {
      fs::path dir = fs::path(base) / L"cartel-agent";
      std::error_code ec;
      fs::create_directories(dir, ec);
      ruta_ = dir / L"agente.log";
      // Rotación simple: si pasa de 256 KB, el viejo se guarda como .old.
      if (fs::exists(ruta_, ec) && fs::file_size(ruta_, ec) > 256 * 1024) {
        fs::path viejo = dir / L"agente.log.old";
        fs::remove(viejo, ec);
        fs::rename(ruta_, viejo, ec);
      }
    }
  }
  void escribir(const std::string& msg) {
    char hora[32];
    std::time_t t = std::time(nullptr);
    std::tm local{};
    localtime_s(&local, &t);
    std::strftime(hora, sizeof(hora), "%Y-%m-%d %H:%M:%S", &local);
    std::string linea = std::string(hora) + "  " + msg + "\n";
    if (!ruta_.empty()) {
      std::ofstream f(ruta_, std::ios::app | std::ios::binary);
      f << linea;
    }
    if (consola_) {
      std::fputs(linea.c_str(), stdout);
      std::fflush(stdout);
    }
  }
  const fs::path& ruta() const { return ruta_; }

 private:
  fs::path ruta_;
  bool consola_ = false;
};

Registro registro;

// ----------------------------------------------------------------- Utilidades
std::string aUtf8(const std::wstring& w) {
  if (w.empty()) return std::string();
  int n = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), nullptr, 0, nullptr, nullptr);
  std::string s(n, '\0');
  WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), &s[0], n, nullptr, nullptr);
  return s;
}

// Codifica un valor para ponerlo en una URL (%XX para lo que no sea seguro).
std::string codificarUrl(const std::string& s) {
  static const char* hex = "0123456789ABCDEF";
  std::string r;
  for (unsigned char c : s) {
    if (std::isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') r += (char)c;
    else { r += '%'; r += hex[c >> 4]; r += hex[c & 15]; }
  }
  return r;
}

fs::path carpetaDelExe() {
  wchar_t ruta[MAX_PATH * 2];
  GetModuleFileNameW(nullptr, ruta, (DWORD)(sizeof(ruta) / sizeof(ruta[0])));
  return fs::path(ruta).parent_path();
}

void conectarConsola() {
  // El programa no tiene ventana; si lo lanzas desde una terminal, nos
  // "enganchamos" a ella para poder escribir texto.
  // Si la salida ya está redirigida a un archivo o tubería (> salida.txt), la
  // respeto tal cual: así se puede capturar desde scripts.
  HANDLE salida = GetStdHandle(STD_OUTPUT_HANDLE);
  if (salida != nullptr && salida != INVALID_HANDLE_VALUE) return;
  if (AttachConsole(ATTACH_PARENT_PROCESS) || AllocConsole()) {
    FILE* f = nullptr;
    freopen_s(&f, "CONOUT$", "w", stdout);
    freopen_s(&f, "CONOUT$", "w", stderr);
    SetConsoleOutputCP(CP_UTF8);
  }
}

// ----------------------------------------------------------- Micro de prueba
// Para probar el agente sin micrófono real: un archivo cuyo primer carácter
// es '1' (micro en uso) o '0'. Se puede editar a mano mientras corre.
bool leerMicroFalso(const fs::path& ruta) {
  std::ifstream f(ruta);
  char c = '0';
  f.get(c);
  return c == '1';
}

// ------------------------------------------------------------- Envío al cartel
bool enviarEstado(const Config& cfg, Estado e, std::string& detalle) {
  std::string ruta = (e == Estado::Ocupado) ? "/ocupado" : "/libre";
  if (!cfg.token.empty()) ruta += "?k=" + codificarUrl(cfg.token);

  std::vector<std::string> destinos{cfg.host};
  if (!cfg.host_respaldo.empty()) destinos.push_back(cfg.host_respaldo);

  for (const auto& host : destinos) {
    if (enviarGet(host, cfg.puerto, ruta, cfg.timeout_http_ms, detalle)) {
      detalle = host + " -> " + detalle;
      return true;
    }
    detalle = host + ": " + detalle;  // si fallan todos, queda el último motivo
  }
  return false;
}

// ------------------------------------------------------------- Bucle principal
int ejecutar(const Config& cfg, bool microFalso, const fs::path& archivoFalso) {
  HANDLE evParar = CreateEventW(nullptr, TRUE, FALSE, NOMBRE_EVENTO_PARAR);

  Tiempos tiempos;
  tiempos.latido_ms = (uint64_t)cfg.latido_s * 1000;
  tiempos.retardo_libre_ms = (uint64_t)cfg.retardo_libre_s * 1000;
  tiempos.reintento_ms = (uint64_t)cfg.reintento_s * 1000;
  Decisor decisor(tiempos);
  DetectorMic detector;

  registro.escribir("Agente iniciado. Cartel: " + cfg.host + ":" + std::to_string(cfg.puerto) +
                    (cfg.host_respaldo.empty() ? "" : " (respaldo " + cfg.host_respaldo + ")") +
                    ", latido " + std::to_string(cfg.latido_s) + " s, retardo a PASAR " +
                    std::to_string(cfg.retardo_libre_s) + " s");

  bool primeraLectura = true, micAntes = false, envioOkAntes = true;
  Estado ultimoEstadoLogueado = Estado::Desconocido;
  std::string errorMicAntes;

  while (WaitForSingleObject(evParar, primeraLectura ? 0 : cfg.sondeo_ms) == WAIT_TIMEOUT) {
    // 1. Leer el micro (real o de prueba)
    bool activo = false;
    if (microFalso) {
      activo = leerMicroFalso(archivoFalso);
    } else {
      LecturaMic l = detector.leer();
      activo = l.activo;
      if (l.error != errorMicAntes) {
        if (!l.error.empty()) registro.escribir("AVISO: " + l.error);
        errorMicAntes = l.error;
      }
      if (activo != micAntes || primeraLectura) {
        std::string quien;
        for (const auto& a : l.aplicaciones) quien += (quien.empty() ? "" : ", ") + a;
        registro.escribir(std::string("Micrófono ") + (activo ? "EN USO" : "libre") +
                          (activo ? " por: " + quien : "") + "  [" + std::to_string(l.dispositivos) +
                          " micros revisados]");
      }
    }
    if (microFalso && (activo != micAntes || primeraLectura))
      registro.escribir(std::string("Micrófono (simulado) ") + (activo ? "EN USO" : "libre"));
    micAntes = activo;
    primeraLectura = false;

    // 2. Preguntar al cerebro si hay que avisar al cartel
    uint64_t ahora = GetTickCount64();
    Accion a = decisor.tick(ahora, activo);
    if (a.enviar) {
      std::string detalle;
      bool ok = enviarEstado(cfg, a.estado, detalle);
      decisor.resultadoEnvio(ok, GetTickCount64());
      // Solo escribo en el log los cambios y los fallos nuevos, no cada latido
      // (cada 15 s llenarían el archivo de líneas repetidas).
      if (!ok && envioOkAntes) {
        registro.escribir(std::string("ERROR enviando '") + nombreEstado(a.estado) + "': " + detalle);
      } else if (ok && (!envioOkAntes || a.estado != ultimoEstadoLogueado)) {
        registro.escribir(std::string("Enviado '") + nombreEstado(a.estado) + "' (" + detalle + ")");
        ultimoEstadoLogueado = a.estado;
      }
      envioOkAntes = ok;
    }
  }
  registro.escribir("Agente detenido.");
  if (evParar) CloseHandle(evParar);
  return 0;
}

void ayuda() {
  std::fputs(
      "cartel-agent: avisa al cartel LED cuando el micrófono está en uso.\n"
      "  (sin argumentos)       arranca en segundo plano, sin ventana\n"
      "  --consola              muestra el registro en esta consola\n"
      "  --estado               indica si el micro está en uso y sale\n"
      "  --parar                detiene la copia que esté en marcha\n"
      "  --config RUTA          usa otro archivo de configuración\n"
      "  --micro-falso ARCHIVO  (pruebas) micro simulado: 1 = en uso, 0 = libre\n",
      stdout);
}

}  // namespace

int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) {
  // --- Argumentos ---------------------------------------------------------
  int argc = 0;
  LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  bool consola = false, soloEstado = false, parar = false, pedirAyuda = false;
  fs::path rutaConfig = carpetaDelExe() / L"config.ini";
  bool configExplicita = false;
  bool microFalso = false;
  fs::path archivoFalso;
  for (int i = 1; i < argc; i++) {
    std::wstring a = argv[i];
    if (a == L"--consola") consola = true;
    else if (a == L"--estado") soloEstado = true;
    else if (a == L"--parar") parar = true;
    else if (a == L"--ayuda" || a == L"--help" || a == L"-h") pedirAyuda = true;
    else if (a == L"--config" && i + 1 < argc) { rutaConfig = argv[++i]; configExplicita = true; }
    else if (a == L"--micro-falso" && i + 1 < argc) { microFalso = true; archivoFalso = argv[++i]; }
    else { consola = true; pedirAyuda = true; }  // argumento desconocido: enseño la ayuda
  }
  LocalFree(argv);

  if (consola || soloEstado || parar || pedirAyuda) conectarConsola();
  if (pedirAyuda) { ayuda(); return 0; }

  // --- --parar: avisar a la otra copia -----------------------------------
  if (parar) {
    HANDLE ev = OpenEventW(EVENT_MODIFY_STATE, FALSE, NOMBRE_EVENTO_PARAR);
    if (!ev) { std::puts("No hay ningún agente en marcha."); return 1; }
    SetEvent(ev);
    CloseHandle(ev);
    std::puts("Orden de parada enviada.");
    return 0;
  }

  // --- --estado: una sola lectura -----------------------------------------
  if (soloEstado) {
    DetectorMic d;
    LecturaMic l = d.leer();
    if (!l.error.empty()) { std::printf("ERROR: %s\n", l.error.c_str()); return 2; }
    std::string quien;
    for (const auto& a : l.aplicaciones) quien += (quien.empty() ? "" : ", ") + a;
    std::printf("microfono: %s (revisados %d dispositivos)%s%s\n", l.activo ? "EN USO" : "libre", l.dispositivos,
                l.activo ? " por: " : "", quien.c_str());
    return l.activo ? 10 : 0;  // código 10 = en uso (cómodo para scripts)
  }

  // --- Solo una copia a la vez --------------------------------------------
  HANDLE mutex = CreateMutexW(nullptr, TRUE, NOMBRE_MUTEX);
  if (GetLastError() == ERROR_ALREADY_EXISTS) {
    if (consola) std::puts("Ya hay un agente en marcha (usa --parar para detenerlo).");
    return 1;
  }

  registro.iniciar(consola);

  Config cfg;
  std::string error;
  if (!cargarConfig(rutaConfig, cfg, error)) {
    if (configExplicita || fs::exists(rutaConfig)) {
      // El archivo existe pero está mal: mejor parar que enviar a un sitio equivocado.
      registro.escribir("ERROR de configuración: " + error + " (archivo: " + aUtf8(rutaConfig.wstring()) + ")");
      return 3;
    }
    registro.escribir("AVISO: no hay config.ini junto al programa; uso valores por defecto (cartel.local).");
    cfg = Config();
  }

  int r = ejecutar(cfg, microFalso, archivoFalso);
  if (mutex) CloseHandle(mutex);
  return r;
}
