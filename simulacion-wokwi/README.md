# Simulación del firmware en Wokwi

Circuito: ESP32 DevKit + matriz WS2812B 8×32 en **IO16** con resistencia de 330 Ω, y dos pulsadores que hacen de "PC" (el WiFi entrante de Wokwi es de pago, así que en simulación el firmware se compila con `SIMULACION`: sin red, con botones y comandos por serie).

| Entrada | Efecto |
|---|---|
| Botón rojo (IO25) o `o` por el monitor serie | como `GET /ocupado` → NO PASAR |
| Botón verde (IO26) o `l` por el monitor serie | como `GET /libre` → PASAR |
| `e` por el monitor serie | imprime estado y consumo |
| 45 s sin pulsar nada | pasa a neutro (`?`), igual que sin latido |

## Opción A — Editor web (sin instalar nada)

1. Abre <https://wokwi.com/projects/new/esp32> (crear proyecto ESP32 en Arduino).
2. Sustituye el contenido de `diagram.json` por el de este directorio.
3. Pega `libraries.txt` y, en la pestaña de archivos, crea `cartel.ino`, `config.h`, `fuente3x5.h`, `pantalla.h` y `animaciones.h` copiando los de [`../firmware-esp32/cartel/`](../firmware-esp32/cartel). **No** crees `secrets.h`: sin él, el firmware entra solo en modo simulación.
4. Pulsa ▶ y usa los botones.

## Opción B — VS Code (extensión Wokwi) o `wokwi-cli`

```bash
cd firmware-esp32
pio run -e wokwi
```

Abre esta carpeta (`simulacion-wokwi/`) con la extensión Wokwi y pulsa *Start Simulation*; `wokwi.toml` ya apunta al firmware compilado.

## Notas

- El panel virtual numera los píxeles por filas; el panel real de 8×32 suele ir en zigzag por columnas. El firmware elige el orden solo (ver `MATRIZ_ORDEN` en `config.h`).
- Este circuito se ha escrito a mano a partir de la documentación de Wokwi; el firmware en modo `wokwi` sí se ha compilado, pero la carga del `diagram.json` en Wokwi conviene comprobarla la primera vez (nombres de pines o atributos de la matriz virtual podrían necesitar un ajuste).
