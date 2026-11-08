// =============================================================================
//  cartel.ino — Cartel "NO PASAR / PASAR" para teletrabajo (ESP32 + WS2812B 8x32)
// =============================================================================
//  Qué hace:
//    1. Se conecta al WiFi y se anuncia como  http://cartel.local  (mDNS).
//    2. Sirve unos endpoints HTTP muy simples. El PC de la persona que teletrabaja
//       llama a /ocupado cuando el micrófono está en uso y a /libre cuando no.
//    3. Dibuja el estado en la matriz de LEDs con animaciones suaves.
//    4. Si deja de recibir noticias del PC (latido), pasa a un estado neutro
//       en vez de quedarse en "NO PASAR" para siempre.
//
//  Endpoints (todos GET; si defines TOKEN_CARTEL, añade  ?k=TU_TOKEN):
//    /ocupado   -> NO PASAR (rojo). También cuenta como latido.
//    /libre     -> PASAR (verde). También cuenta como latido.
//    /estado    -> JSON con el estado, tiempo desde el último latido, mA, IP...
//    /brillo?v=N-> cambia el brillo (0..BRILLO_MAX) hasta el próximo reinicio.
//    /          -> página con botones para probar desde el móvil.
//
//  Modo SIMULACION (Wokwi / sin WiFi): ver config del proyecto en platformio.ini.
//  Ahí no hay red: dos botones y comandos por el puerto serie hacen de "PC".
// =============================================================================
#include <Arduino.h>
#include <Adafruit_NeoPixel.h>

#include "config.h"
#include "animaciones.h"

// --- ¿Compilamos para el cartel real o para simulación? ----------------------
// Si no existe secrets.h (p. ej. en el editor web de Wokwi) pasamos
// automáticamente a SIMULACION en lugar de fallar al compilar.
#if !defined(SIMULACION) && !__has_include("secrets.h")
#warning "No existe secrets.h: compilo en modo SIMULACION. Copia secrets.example.h a secrets.h para el cartel real."
#define SIMULACION 1
#endif

#ifndef SIMULACION
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include "secrets.h"   // WIFI_SSID, WIFI_PASS, TOKEN_CARTEL (ver secrets.example.h)
#endif

// En simulación los "botones del PC" van a estos pines:
constexpr uint8_t PIN_BOTON_OCUPADO = 25;
constexpr uint8_t PIN_BOTON_LIBRE   = 26;

// --- Variables globales ------------------------------------------------------
// NEO_GRB + NEO_KHZ800 es el orden de color y la velocidad de las WS2812B.
Adafruit_NeoPixel tira(NUM_LEDS, PIN_DATOS, NEO_GRB + NEO_KHZ800);

Estado   estado           = ARRANQUE;  // lo que se muestra "de fondo"
uint32_t inicioEstado     = 0;         // millis() en que empezó este estado (para animar)
uint32_t ultimoLatido     = 0;         // millis() de la última orden recibida
uint32_t ultimoFotograma  = 0;
uint8_t  brilloActual     = BRILLO_INICIAL;

Marco    marcoActual;                  // lo último que se ha mostrado
bool     enTransicion     = false;
uint32_t inicioTransicion = 0;
Marco    marcoViejo;                   // fotograma de partida de la transición

// Fase de arranque: primero "...", luego el texto con la IP, luego NEUTRO.
bool     arranqueMostrandoIP = false;
uint32_t arranqueInicioIP    = 0;
char     textoIP[32]         = "";

double   ultimosMilis = 0;             // consumo estimado del último fotograma

const char* nombreEstado(Estado e) {
  switch (e) {
    case OCUPADO: return "ocupado";
    case LIBRE:   return "libre";
    case NEUTRO:  return "neutro";
    default:      return "arrancando";
  }
}

// -----------------------------------------------------------------------------
//  Cambiar de estado
// -----------------------------------------------------------------------------
void cambiarEstado(Estado nuevo) {
  if (nuevo == estado) return;
  Serial.printf("[estado] %s -> %s\n", nombreEstado(estado), nombreEstado(nuevo));
  // Guardo lo que se ve ahora para que el barrido parta de ahí.
  marcoViejo       = marcoActual;
  enTransicion     = true;
  inicioTransicion = millis();
  estado           = nuevo;
  inicioEstado     = millis();
}

// Llamado cuando llega una orden del PC (/ocupado o /libre).
// Toda orden es también un latido: demuestra que el PC sigue vivo.
void recibirOrden(Estado nuevo) {
  ultimoLatido = millis();
  if (estado == ARRANQUE) {
    // Si llega una orden mientras aún arranco, salto el texto de la IP.
    arranqueMostrandoIP = false;
  }
  cambiarEstado(nuevo);
}

// -----------------------------------------------------------------------------
//  Servidor web (solo en el cartel real)
// -----------------------------------------------------------------------------
#ifndef SIMULACION
WebServer servidor(80);
bool      mdnsActivo    = false;
bool      eraConectado  = false;
uint32_t  ultimoIntentoWiFi = 0;

// Si has puesto un token en secrets.h, hay que mandarlo en ?k=...
// POR QUÉ: cualquiera de tu WiFi podría llamar a /libre. No es seguridad seria
// (HTTP va sin cifrar), pero evita bromas y errores en una red doméstica.
bool autorizado() {
  if (strlen(TOKEN_CARTEL) == 0) return true;
  if (servidor.arg("k") == TOKEN_CARTEL) return true;
  servidor.send(403, "text/plain", "token incorrecto");
  return false;
}

void atenderOcupado() {
  if (!autorizado()) return;
  Serial.println("[http] GET /ocupado");
  recibirOrden(OCUPADO);
  servidor.send(200, "text/plain", "ok ocupado");
}

void atenderLibre() {
  if (!autorizado()) return;
  Serial.println("[http] GET /libre");
  recibirOrden(LIBRE);
  servidor.send(200, "text/plain", "ok libre");
}

void atenderEstado() {
  if (!autorizado()) return;
  char json[256];
  snprintf(json, sizeof(json),
           "{\"estado\":\"%s\",\"segundos_desde_latido\":%lu,\"brillo\":%u,"
           "\"ma_estimados\":%d,\"ip\":\"%s\",\"wifi_rssi\":%d,\"uptime_s\":%lu}",
           nombreEstado(estado), (unsigned long)((millis() - ultimoLatido) / 1000),
           brilloActual, (int)(ultimosMilis + 0.5), WiFi.localIP().toString().c_str(),
           WiFi.RSSI(), (unsigned long)(millis() / 1000));
  servidor.send(200, "application/json", json);
}

void atenderBrillo() {
  if (!autorizado()) return;
  if (!servidor.hasArg("v")) { servidor.send(400, "text/plain", "falta ?v=0..255"); return; }
  int v = servidor.arg("v").toInt();
  if (v < 0) v = 0;
  if (v > BRILLO_MAX) v = BRILLO_MAX;   // el tope NO se puede saltar por la web
  brilloActual = (uint8_t)v;
  servidor.send(200, "text/plain", String("ok brillo ") + v);
}

void atenderRaiz() {
  // Página mínima para probar a mano. Los botones reutilizan el ?k= de la URL.
  static const char pagina[] PROGMEM =
      "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>"
      "<title>Cartel</title><body style='font-family:sans-serif;text-align:center;padding:2em'>"
      "<h1>Cartel NO PASAR</h1><p id=e>...</p>"
      "<button onclick=\"z('ocupado')\" style='font-size:1.5em;background:#e33;color:#fff'>NO PASAR</button> "
      "<button onclick=\"z('libre')\" style='font-size:1.5em;background:#2a2;color:#fff'>PASAR</button>"
      "<script>const k=location.search;"
      "function z(r){fetch('/'+r+k).then(()=>s())}"
      "function s(){fetch('/estado'+k).then(r=>r.json()).then(j=>e.textContent='Estado: '+j.estado+"
      "' · latido hace '+j.segundos_desde_latido+' s · ~'+j.ma_estimados+' mA')}"
      "s();setInterval(s,2000)</script>";
  servidor.send_P(200, "text/html", pagina);
}

void atenderNoEncontrado() {
  servidor.send(404, "text/plain", "no existe. Prueba /estado, /ocupado o /libre");
}

void iniciarServidor() {
  servidor.on("/", atenderRaiz);
  servidor.on("/ocupado", atenderOcupado);
  servidor.on("/libre", atenderLibre);
  servidor.on("/estado", atenderEstado);
  servidor.on("/brillo", atenderBrillo);
  servidor.onNotFound(atenderNoEncontrado);
  servidor.begin();
}

// mDNS: anuncia el nombre "cartel.local". Hay que repetirlo si el WiFi se cae
// y vuelve, porque el servicio se pierde con la conexión.
void iniciarMDNS() {
  if (mdnsActivo) MDNS.end();
  mdnsActivo = MDNS.begin("cartel");
  if (mdnsActivo) MDNS.addService("http", "tcp", 80);
  Serial.println(mdnsActivo ? "[mdns] http://cartel.local" : "[mdns] ERROR al iniciar");
}

// Vigila el WiFi. ESP32 ya reintenta solo (setAutoReconnect), pero si lleva más
// de 30 s sin conexión forzamos un reintento por si se quedó atascado.
void vigilarWiFi() {
  bool conectado = (WiFi.status() == WL_CONNECTED);
  if (conectado && !eraConectado) {
    Serial.printf("[wifi] conectado, IP %s\n", WiFi.localIP().toString().c_str());
    iniciarMDNS();
  }
  if (!conectado && millis() - ultimoIntentoWiFi > 30000) {
    ultimoIntentoWiFi = millis();
    Serial.println("[wifi] sin conexión, reintentando...");
    WiFi.reconnect();
  }
  eraConectado = conectado;
}
#endif  // !SIMULACION

// -----------------------------------------------------------------------------
//  Simulación: botones y puerto serie hacen de "PC"
// -----------------------------------------------------------------------------
#ifdef SIMULACION
bool botonOcupadoAntes = false, botonLibreAntes = false;

void leerEntradasSimulacion() {
  // INPUT_PULLUP: el pin vale 1 en reposo y 0 al pulsar.
  bool bo = (digitalRead(PIN_BOTON_OCUPADO) == LOW);
  bool bl = (digitalRead(PIN_BOTON_LIBRE) == LOW);
  if (bo && !botonOcupadoAntes) recibirOrden(OCUPADO);
  if (bl && !botonLibreAntes)   recibirOrden(LIBRE);
  botonOcupadoAntes = bo;
  botonLibreAntes   = bl;

  while (Serial.available()) {
    char c = Serial.read();
    if (c == 'o') recibirOrden(OCUPADO);
    else if (c == 'l') recibirOrden(LIBRE);
    else if (c == 'e') Serial.printf("[estado] %s, latido hace %lu s, ~%d mA\n", nombreEstado(estado),
                                     (unsigned long)((millis() - ultimoLatido) / 1000), (int)(ultimosMilis + 0.5));
  }
}
#endif

// -----------------------------------------------------------------------------
//  Dibujar en la tira
// -----------------------------------------------------------------------------
// Aplica el brillo seguro y envía el fotograma a los LEDs.
void mostrar(const Marco& m) {
  uint8_t b = brilloSeguro(m, brilloActual);
  ultimosMilis = estimarMilis(m, b);
  // Escalo yo los colores (en vez de usar tira.setBrightness) porque
  // setBrightness de Adafruit modifica los datos ya guardados y pierde
  // precisión si lo cambio en cada fotograma.
  for (int y = 0; y < ALTO; y++) {
    for (int x = 0; x < ANCHO; x++) {
      const Color& c = m.p[y][x];
      tira.setPixelColor(indiceLed(x, y), tira.Color((c.r * b) / 255, (c.g * b) / 255, (c.b * b) / 255));
    }
  }
  tira.show();
}

void fotograma() {
  uint32_t ahora = millis();
  Marco nuevo;

  if (estado == ARRANQUE) {
    uint32_t t = ahora - inicioEstado;
    if (arranqueMostrandoIP) {
      bool fin = dibujarScroll(nuevo, textoIP, ahora - arranqueInicioIP, CIAN);
      if (fin) { arranqueMostrandoIP = false; cambiarEstado(NEUTRO); ultimoLatido = ahora; }
    } else {
      dibujarConectando(nuevo, t);
    }
  } else {
    dibujarEstado(nuevo, estado, ahora - inicioEstado);
  }

  if (enTransicion) {
    double p = (double)(ahora - inicioTransicion) / DURACION_TRANSICION;
    if (p >= 1.0) enTransicion = false;
    else mezclarTransicion(nuevo, marcoViejo, p);
  }

  marcoActual = nuevo;
  mostrar(nuevo);
}

// -----------------------------------------------------------------------------
//  setup / loop
// -----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n== Cartel NO PASAR ==");

  tira.begin();
  tira.clear();
  tira.show();
  limpiar(marcoActual);

  inicioEstado = millis();

#ifdef SIMULACION
  Serial.println("MODO SIMULACION: botones 25 (ocupado) y 26 (libre); o escribe o / l / e en el serie.");
  pinMode(PIN_BOTON_OCUPADO, INPUT_PULLUP);
  pinMode(PIN_BOTON_LIBRE, INPUT_PULLUP);
  // Sin WiFi no hay IP que enseñar: tras un instante de "..." pasamos a NEUTRO
  // (lo hace loop()).
#else
  WiFi.mode(WIFI_STA);
  WiFi.setHostname("cartel");
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("[wifi] conectando a %s ", WIFI_SSID);

  // Mientras conecta (máx. ESPERA_WIFI_MS) animo "..." para que se vea que vive.
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < ESPERA_WIFI_MS) {
    Marco m;
    dibujarConectando(m, millis() - t0);
    marcoActual = m;
    mostrar(m);
    delay(INTERVALO_FOTOGRAMA);
  }

  iniciarServidor();
  if (WiFi.status() == WL_CONNECTED) {
    eraConectado = false;  // fuerza que vigilarWiFi() inicie mDNS y lo muestre en el serie
    snprintf(textoIP, sizeof(textoIP), "IP %s", WiFi.localIP().toString().c_str());
    arranqueMostrandoIP = true;
    arranqueInicioIP = millis();
  } else {
    Serial.println("\n[wifi] no conecta todavía; seguiré intentándolo en segundo plano.");
    arranqueMostrandoIP = false;
  }
#endif
  ultimoLatido = millis();
}

void loop() {
#ifdef SIMULACION
  leerEntradasSimulacion();
  // En simulación acabo el arranque tras 1,5 s.
  if (estado == ARRANQUE && millis() - inicioEstado > 1500) cambiarEstado(NEUTRO);
#else
  servidor.handleClient();
  vigilarWiFi();
  // Si el WiFi no conectó al arrancar, tampoco hay IP: salgo del arranque a los 3 s.
  if (estado == ARRANQUE && !arranqueMostrandoIP && millis() - inicioEstado > 3000) cambiarEstado(NEUTRO);
#endif

  // Sin latido del PC durante TIMEOUT_LATIDO_MS => estado neutro.
  if ((estado == OCUPADO || estado == LIBRE) && millis() - ultimoLatido > TIMEOUT_LATIDO_MS) {
    Serial.println("[latido] sin noticias del PC: paso a NEUTRO");
    cambiarEstado(NEUTRO);
  }

  uint32_t ahora = millis();
  if (ahora - ultimoFotograma >= INTERVALO_FOTOGRAMA) {
    ultimoFotograma = ahora;
    fotograma();
  }
}
