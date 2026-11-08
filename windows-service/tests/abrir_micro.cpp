// =============================================================================
//  abrir_micro.cpp — Herramienta de PRUEBA: se comporta como "una app de llamadas"
// =============================================================================
//  Abre el micrófono predeterminado con WASAPI (igual que hacen Teams, Chrome,
//  Zoom...) y lo mantiene abierto N segundos. Sirve para comprobar que
//  `cartel-agent --estado` lo detecta como "EN USO" sin tener que montar una
//  videollamada.
//
//  Solo abre y arranca el flujo: NO lee ni guarda ni un byte de audio.
//
//  Uso:   abrir_micro.exe [segundos]      (por defecto 10)
// =============================================================================
#include <windows.h>
#include <audioclient.h>
#include <mmdeviceapi.h>

#include <cstdio>
#include <cstdlib>

int main(int argc, char** argv) {
  int segundos = argc > 1 ? std::atoi(argv[1]) : 10;
  CoInitializeEx(nullptr, COINIT_MULTITHREADED);

  IMMDeviceEnumerator* enumerador = nullptr;
  IMMDevice* dispositivo = nullptr;
  IAudioClient* cliente = nullptr;
  WAVEFORMATEX* formato = nullptr;

  HRESULT hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL, __uuidof(IMMDeviceEnumerator),
                                (void**)&enumerador);
  if (SUCCEEDED(hr)) hr = enumerador->GetDefaultAudioEndpoint(eCapture, eConsole, &dispositivo);
  if (SUCCEEDED(hr)) hr = dispositivo->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, (void**)&cliente);
  if (SUCCEEDED(hr)) hr = cliente->GetMixFormat(&formato);
  if (SUCCEEDED(hr)) hr = cliente->Initialize(AUDCLNT_SHAREMODE_SHARED, 0, 10000000, 0, formato, nullptr);
  if (SUCCEEDED(hr)) hr = cliente->Start();   // <- a partir de aquí la sesión pasa a "Activa"

  if (FAILED(hr)) {
    std::printf("No se pudo abrir el micro (HRESULT 0x%08lx). ¿Permiso de micrófono denegado en Windows?\n",
                (unsigned long)hr);
    return 1;
  }
  std::printf("Micro abierto durante %d s (sin leer audio)...\n", segundos);
  std::fflush(stdout);
  Sleep((DWORD)segundos * 1000);
  cliente->Stop();
  std::printf("Micro cerrado.\n");
  return 0;
}
