# Simulación IoT y escenarios de demostración

Este documento describe cómo funciona el simulador de sensores de **Museo_Smart**
(Node-RED + MQTT), su comportamiento normal y los escenarios controlables que
sirven para demostrar el monitoreo, las alertas y la popularidad sin tocar la
lógica real del sistema.

> El simulador solo sustituye al generador de datos. El backend procesa los
> mensajes exactamente igual que si vinieran de sensores físicos: mismas
> validaciones, mismos topics, mismo formato. **No se alteran** la lógica de
> alertas, Redis, InfluxDB ni el esquema del mensaje.

---

## 1. Comportamiento normal (sin escenarios)

Cada 5 segundos el flujo publica **18 mensajes**:

| Grupo | Cantidad | Topic | Identidad |
|---|---|---|---|
| Ambiental | 6 (uno por sala) | `museo/sensores/ambiental` | `sensorCodigo` |
| Presencia | 12 (una por exhibición) | `museo/sensores/presencia` | `sensorCodigo` |

El payload mantiene el formato original, sin ids:

```json
{ "mensajeId": "<uuid>", "sensorCodigo": "SENSOR-AMBIENTAL-001",
  "temperatura": 20.4, "humedad": 49.8, "luminosidad": 110.2,
  "timestamp": "2026-11-06T06:00:00.000Z" }

{ "mensajeId": "<uuid>", "sensorCodigo": "SENSOR-PRESENCIA-002",
  "presencia": true, "timestamp": "2026-11-06T06:00:00.000Z" }
```

### Ambiente: reversión a la media + ciclo diario

- Cada sala tiene un **valor base dentro de su rango ideal real** (consultado
  en PostgreSQL) y revierte hacia él (`K_REVERSION = 0.35`), con ruido pequeño.
  No es un paseo aleatorio libre: no se "escapa" del rango con el tiempo.
- Un **ciclo diario suave** (máximo hacia las 15:00, mínimo hacia las 03:00)
  aporta ±0.55–0.60 °C y ±1.2–1.5 % de humedad.
- **Luz según horario de museo** (9:00–18:00): 50–150 lux en salas con pinturas
  o textiles (Salas 1 y 4) y hasta 200–245 en el resto. Fuera de horario, ≈ 0.
- Sin escenarios, **ninguna sala queda fuera de rango** (verificado con 24 h
  simuladas contra los límites reales de cada sala: 0 violaciones).

### Presencia: horario + popularidad + duración real

- La probabilidad de que **empiece** una visita depende de la hora:
  - 10:00–13:00 y 15:00–17:00 → **alta** (0.10)
  - resto del horario → **baja** (0.025)
  - fuera de horario → **casi nula** (0.0005)
- Cada exhibición tiene un **peso de popularidad**: Triceratops (3.0),
  Washington (2.8), Ramsés II (2.6) son las más visitadas; Vasija (0.4) y
  Diente de megalodón (0.5) las menos. Así el ranking tiene sentido.
- Una visita **dura entre 20 s y 2 min**, por lo que el estado no cambia en cada
  ciclo de 5 s (evita contar una visita por mensaje).

### Horario de visita forzado

Una variable de `flow` (`horarioForzado`) hace que el simulador se comporte como
si fueran las **11:00**. Sirve para demostrar de noche: luz encendida y
visitantes distribuidos por popularidad. Se controla desde la sección
**Simulador** del panel o publicando en `museo/simulador/horario`.

---

## 2. Escenarios de demostración

Se activan desde el panel (sección **Simulador**, solo SUPERADMIN y solo si el
backend tiene `APP_SIMULADOR_HABILITADO=true`) o publicando directamente en
`museo/simulador/escenario` (QoS 1):

```json
{ "tipo": "FALLA_CLIMA", "sala": "SALA_1" }
{ "tipo": "SENSOR_DESCONECTADO", "sensorCodigo": "SENSOR-AMBIENTAL-003" }
{ "tipo": "RESTABLECER", "sala": "SALA_1" }
{ "tipo": "RESTABLECER", "todo": true }
```

| Escenario | Efecto | Duración | Qué demuestra |
|---|---|---|---|
| `FALLA_CLIMA` | Temperatura sube ~0.5 °C por ciclo hasta ~28 °C; humedad baja | 10 min | Se abre alerta de temperatura/humedad; la gráfica muestra el tramo fuera de rango |
| `HUMEDAD_ALTA` | Humedad sube gradualmente hasta ~75 % | 10 min | Riesgo de moho; alerta de humedad |
| `EXCESO_LUZ` | Luz sube a ~600 lux | 10 min | Daño por radiación; alerta de luz |
| `GRUPO_VISITANTES` | Presencia continua en las 2 exhibiciones de la sala | 2 min | Suben las visitas y cambia el ranking de popularidad |
| `SENSOR_DESCONECTADO` | Ese sensor deja de publicar | 10 min | El panel lo muestra sin datos recientes al expirar su estado en Redis (5 min) |
| `RESTABLECER` | Vuelve gradualmente al comportamiento normal | — | Las alertas se resuelven solas al volver al rango |

Los cambios son **graduales** (sin saltos) y los escenarios **expiran solos a
los 10 minutos** si nadie los restablece (`GRUPO_VISITANTES` a los 2 min).

El estado activo se publica **retained** en `museo/simulador/estado`:

```json
{ "escenarios": [ { "tipo": "FALLA_CLIMA", "objetivo": "SALA_1",
                    "desde": 1793944858669, "hasta": 1793945458669,
                    "restantesSeg": 600 } ],
  "horarioForzado": false,
  "actualizadoEn": "2026-11-06T06:00:58.684Z" }
```

---

## 3. Configuración del backend

| Variable | Por defecto | Efecto |
|---|---|---|
| `APP_SIMULADOR_HABILITADO` | `false` | Con `false` las rutas `/api/v1/admin/simulador/**` responden **404** |

Endpoints (solo **SUPERADMIN**, y solo con el flag en `true`):

| Método | Ruta | Cuerpo |
|---|---|---|
| GET | `/api/v1/admin/simulador/escenarios` | — |
| POST | `/api/v1/admin/simulador/escenarios` | `{ tipo, sala \| sensorCodigo }` |
| POST | `/api/v1/admin/simulador/restablecer` | `{ sala \| sensorCodigo \| todo }` |
| POST | `/api/v1/admin/simulador/horario` | `{ activo }` |

`sala` acepta el **id real** (p. ej. `1`, `23`) o el **código 3D**
(`SALA_1`…`SALA_6`). El backend valida el tipo, la sala y el sensor, y registra
en el log el correo del SUPERADMIN que activó cada escenario.

El backend publica usando su propio cliente MQTT (separado del consumidor) y
escucha el estado retenido para mostrarlo en el panel. No modifica alertas,
Redis ni InfluxDB.

Para habilitarlo, define en tu entorno antes de arrancar:

```powershell
$env:APP_SIMULADOR_HABILITADO = "true"
.\iniciar-museo.ps1
```

---

## 4. Guion de demostración (5 minutos)

> Requisitos: Docker arriba (`mosquitto`, `nodered`, `influxdb`, `redis`),
> backend con `APP_SIMULADOR_HABILITADO=true` y `MQTT_ENABLED=true`, frontend
> en `http://localhost:5173`.

1. **0:00 — Estado normal.** Abre *Monitoreo IoT*. Muestra las 6 salas en verde,
   la gráfica con luz alta (horario de museo) y el ranking estable. Explica que
   los valores base están dentro del rango y que la presencia sigue la
   popularidad.

2. **0:45 — Falla del clima en Sala 1.** Ve a *Simulador*, elige **Falla del
   clima**, Sala 1 y pulsa **Activar**. En 1–2 min:
   - *Monitoreo IoT*: la temperatura de Sala 1 sube y el tramo se pinta en rojo.
   - *Alertas*: aparece "TEMPERATURA fuera de rango…" y la campana sube.
   - Vuelve a *Simulador* y pulsa **Restablecer**: la alerta se resuelve sola.

3. **2:15 — Grupo de visitantes.** Activa **Grupo de visitantes** en Sala 5.
   Abre *Popularidad*: las visitas de las dos exhibiciones de esa sala suben y
   se mueve el ranking. (Expira solo en 2 min.)

4. **3:00 — Sensor desconectado.** Activa **Sensor desconectado** con
   `SENSOR-AMBIENTAL-003`. En *Monitoreo IoT* esa sala deja de actualizar; al
   expirar el estado en Redis (5 min) se muestra como **sin datos recientes**.

5. **3:45 — Demostración nocturna.** Activa el interruptor **Horario de visita
   forzado**. Aunque sea de noche, la luz se enciende y vuelve la presencia
   como a las 11:00. Desactívalo para volver al horario real.

6. **4:30 — Cierre.** Pulsa **Restablecer todo**. Comenta que el sistema vuelve
   solo al rango, que los escenarios expiran a los 10 min y que todo esto usa la
   misma lógica de alertas, Redis e InfluxDB que un sensor real.

---

## 5. Verificación rápida

- **10 min sin escenarios** → 0 alertas nuevas, 0 errores en `mensaje_iot`,
  presencia solo en horario y distribuida por peso.
- **FALLA_CLIMA en Sala 1** → alerta abierta en < 2 min; `RESTABLECER` →
  alertas `RESUELTA`.
- **GRUPO_VISITANTES** → suben las visitas y cambia el ranking.
- **SENSOR_DESCONECTADO** → `TTL` de `museo:sensor:<codigo>` decrece hasta
  expirar (5 min) y el panel lo marca sin datos recientes.
- **ADMIN** → 403. **Flag en false** → 404.
