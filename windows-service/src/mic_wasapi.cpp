#include "mic_wasapi.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <audiopolicy.h>
#include <mmdeviceapi.h>

#include <algorithm>

namespace cartel {

namespace {

// Puntero inteligente mínimo para objetos COM (libera con Release al salir).
// Lo escribo a mano para no depender de ATL, que MinGW no trae.
template <typename T>
class ComPtr {
 public:
  ComPtr() = default;
  ~ComPtr() { liberar(); }
  ComPtr(const ComPtr&) = delete;
  ComPtr& operator=(const ComPtr&) = delete;
  T** dir() { liberar(); return &p_; }
  T* operator->() const { return p_; }
  T* get() const { return p_; }
  explicit operator bool() const { return p_ != nullptr; }
 private:
  void liberar() { if (p_) { p_->Release(); p_ = nullptr; } }
  T* p_ = nullptr;
};

std::string aUtf8(const std::wstring& w) {
  if (w.empty()) return std::string();
  int n = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), nullptr, 0, nullptr, nullptr);
  std::string s(n, '\0');
  WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), &s[0], n, nullptr, nullptr);
  return s;
}

// Nombre del .exe a partir de su PID (solo para mostrarlo en el log).
std::string nombreProceso(DWORD pid) {
  if (pid == 0) return "(desconocido)";
  HANDLE h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
  if (!h) return "pid " + std::to_string(pid);
  wchar_t ruta[MAX_PATH * 2];
  DWORD len = (DWORD)(sizeof(ruta) / sizeof(ruta[0]));
  std::string nombre = "pid " + std::to_string(pid);
  if (QueryFullProcessImageNameW(h, 0, ruta, &len)) {
    std::wstring w(ruta, len);
    size_t barra = w.find_last_of(L"\\/");
    nombre = aUtf8(barra == std::wstring::npos ? w : w.substr(barra + 1));
  }
  CloseHandle(h);
  return nombre;
}

}  // namespace

DetectorMic::DetectorMic() {
  // MTA: no necesitamos bucle de mensajes para hablar con WASAPI.
  HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  comIniciado_ = SUCCEEDED(hr);  // S_FALSE también cuenta (ya estaba iniciado)
}

DetectorMic::~DetectorMic() {
  if (comIniciado_) CoUninitialize();
}

LecturaMic DetectorMic::leer() {
  LecturaMic r;

  // Creo el enumerador en cada lectura (es barato, 1 vez por segundo): así
  // detecto sin reiniciar nada que se enchufen unos cascos nuevos.
  ComPtr<IMMDeviceEnumerator> enumerador;
  HRESULT hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL, __uuidof(IMMDeviceEnumerator),
                                (void**)enumerador.dir());
  if (FAILED(hr)) { r.error = "no se pudo crear el enumerador de dispositivos"; return r; }

  // eCapture = entradas (micrófonos). DEVICE_STATE_ACTIVE = enchufados y habilitados.
  ComPtr<IMMDeviceCollection> coleccion;
  hr = enumerador->EnumAudioEndpoints(eCapture, DEVICE_STATE_ACTIVE, coleccion.dir());
  if (FAILED(hr)) { r.error = "no se pudieron listar los micrófonos"; return r; }

  UINT numDispositivos = 0;
  coleccion->GetCount(&numDispositivos);
  r.dispositivos = (int)numDispositivos;

  const DWORD miPid = GetCurrentProcessId();

  for (UINT i = 0; i < numDispositivos; i++) {
    ComPtr<IMMDevice> dispositivo;
    if (FAILED(coleccion->Item(i, dispositivo.dir()))) continue;

    // El "gestor de sesiones" lista qué programas están usando este micro.
    ComPtr<IAudioSessionManager2> gestor;
    if (FAILED(dispositivo->Activate(__uuidof(IAudioSessionManager2), CLSCTX_ALL, nullptr, (void**)gestor.dir())))
      continue;

    ComPtr<IAudioSessionEnumerator> sesiones;
    if (FAILED(gestor->GetSessionEnumerator(sesiones.dir()))) continue;

    int numSesiones = 0;
    sesiones->GetCount(&numSesiones);

    for (int s = 0; s < numSesiones; s++) {
      ComPtr<IAudioSessionControl> control;
      if (FAILED(sesiones->GetSession(s, control.dir()))) continue;

      // Lo único que se consulta: el ESTADO de la sesión. Nada de audio.
      AudioSessionState estado = AudioSessionStateInactive;
      if (FAILED(control->GetState(&estado))) continue;
      if (estado != AudioSessionStateActive) continue;

      // Necesito más datos (¿es el sonido del sistema? ¿qué PID?).
      ComPtr<IAudioSessionControl2> control2;
      if (FAILED(control->QueryInterface(__uuidof(IAudioSessionControl2), (void**)control2.dir()))) {
        r.activo = true;
        continue;
      }
      if (control2->IsSystemSoundsSession() == S_OK) continue;  // pitidos de Windows: no cuentan

      DWORD pid = 0;
      control2->GetProcessId(&pid);
      if (pid == miPid) continue;  // por si algún día este agente abriese el micro

      r.activo = true;
      std::string nombre = nombreProceso(pid);
      if (std::find(r.aplicaciones.begin(), r.aplicaciones.end(), nombre) == r.aplicaciones.end())
        r.aplicaciones.push_back(nombre);
    }
  }
  return r;
}

}  // namespace cartel
