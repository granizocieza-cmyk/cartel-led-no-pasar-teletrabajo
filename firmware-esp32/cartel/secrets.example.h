// =============================================================================
//  secrets.example.h — Plantilla de credenciales
// =============================================================================
//  1. Copia este archivo con el nombre  secrets.h  (en esta misma carpeta).
//  2. Rellena tus datos.
//  secrets.h está en .gitignore: NUNCA se sube a GitHub.
//
//  Nota: el ESP32 solo se conecta a WiFi de 2,4 GHz (no 5 GHz).
// =============================================================================
#pragma once

#define WIFI_SSID "nombre-de-tu-wifi"
#define WIFI_PASS "contraseña-del-wifi"

// Token opcional. Si lo dejas vacío ("") cualquiera de tu red puede cambiar el
// cartel. Si pones algo (solo letras y números), hay que llamar a
// /ocupado?k=TOKEN. Debe coincidir con "token" en windows-service/config.ini.
#define TOKEN_CARTEL ""
