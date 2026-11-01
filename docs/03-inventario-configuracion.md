# Documento 3. Inventario de configuración

> Valores sensibles: este documento **no reproduce** contraseñas, tokens ni
> secretos. Solo indica donde están, su longitud y cómo obtenerlos o generarlos.
> La existencia de un archivo `docker/.env` con valores reales fue verificada;
> sus valores no se transcriben.

---

## 1. Archivos de configuración

| Archivo | Versionado | Función |
|---|---|---|
| `backend/pom.xml` | Sí | Dependencias y versiones del backend |
| `backend/src/main/resources/application.properties` | Sí | Configuración única de Spring Boot |
| `backend/.env.example` | Sí | Plantilla de variables del backend (incompleta: no lista JWT, mail, Influx, SuperAdmin) |
| `backend/iniciar-museo.ps1` | Sí | Arranque asistido en Windows |
| `frontend/package.json`, `package-lock.json` | Sí | Dependencias del frontend |
| `frontend/vite.config.js` | Sí | Proxy de desarrollo |
| `frontend/.env.local` | **No** (`*.local`) | `VITE_MOCK_AUTH=false` |
| `docker/docker-compose.yml` | Sí | Servicios IoT |
| `docker/.env.example` | Sí | Plantilla de Compose |
| `docker/.env` | **No** | Valores reales del entorno del autor |
| `docker/mosquitto/config/mosquitto.conf` | Sí | Broker MQTT |
| `docker/mosquitto/config/passwd` | **No** (`passwd` ignorado) | Hash generado en runtime |
| `docker/mosquitto/mosquitto-entrypoint.sh` | Sí | Genera `passwd` al arrancar |
| `docker/nodered/museo-smart-flows.json` | Sí | Flujo simulador |
| `docker/nodered/nodered-entrypoint.sh` | Sí | Siembra idempotente del flujo |
| `.gitignore`, `backend/.gitignore`, `frontend/.gitignore` | Sí | Exclusión de secretos y artefactos |

No existen `application.yml`, `application-prod.properties`, `Dockerfile`,
`.dockerignore` ni `compose.yaml`.

---

## 2. Variables de entorno

### 2.1 Backend (`application.properties`)

| Variable | Servicio | Uso | Valor o fuente | Obligatoria |
|---|---|---|---|---|
| `SERVER_PORT` | Backend | Puerto HTTP | default `8080` | No |
| `DB_URL` | PostgreSQL | JDBC URL | default `jdbc:postgresql://localhost:5432/Museo_Smart` | No (default) |
| `DB_USERNAME` | PostgreSQL | Usuario | default `postgres` | No (default) |
| `DB_PASSWORD` | PostgreSQL | Contraseña | **default `postgres` (valor de desarrollo en código)** | No (default inseguro) |
| `JWT_SECRET` | Backend | Firma HMAC-SHA256 | vacío ⇒ clave aleatoria en memoria | **Recomendada** (obligatoria para tokens estables) |
| `JWT_EXPIRACION_MINUTOS` | Backend | Vida del token | default `60` | No |
| `RESET_EXPIRACION_MINUTOS` | Backend | Vida del token de reset | default `15` | No |
| `APP_MAIL_HABILITADO` | SMTP | Activa `SmtpMailService` | default `false` | No |
| `APP_MAIL_FROM` | SMTP | Remitente | default `smartmuseo@gmail.com` (dato en código) | No |
| `MAIL_HOST` | SMTP | Host | default `smtp.gmail.com` | Si mail activo |
| `MAIL_PORT` | SMTP | Puerto | default `587` | Si mail activo |
| `MAIL_USERNAME` | SMTP | Usuario | vacío | Si mail activo |
| `MAIL_PASSWORD` | SMTP | Contraseña de aplicación | vacío | Si mail activo |
| `MQTT_ENABLED` | MQTT | Activa consumidor | default `true` | No |
| `MQTT_BROKER_URL` | MQTT | URL broker | default `tcp://localhost:1884` | No |
| `MQTT_CLIENT_ID` | MQTT | Base del clientId | default `museo-smart-backend` | No |
| `MQTT_USERNAME` | MQTT | Usuario | vacío | Si MQTT activo y broker con auth |
| `MQTT_PASSWORD` | MQTT | Contraseña | vacío | Si MQTT activo y broker con auth |
| `MQTT_TOPICO_AMBIENTAL` | MQTT | Topic | default `museo/sensores/ambiental` | No |
| `MQTT_TOPICO_PRESENCIA` | MQTT | Topic | default `museo/sensores/presencia` | No |
| `MQTT_QOS` | MQTT | QoS | default `1` | No |
| `IOT_TEMP_MIN/MAX` | Validación | Rangos de temperatura | `-100/100` | No |
| `IOT_HUMEDAD_MIN/MAX` | Validación | Rangos de humedad | `0/100` | No |
| `IOT_LUZ_MIN/MAX` | Validación | Rangos de luz | `0/200000` | No |
| `INFLUX_ENABLED` | InfluxDB | Activa drenado | default `true` | No |
| `INFLUX_URL` | InfluxDB | URL base | default `http://localhost:8087` | No |
| `INFLUX_TOKEN` | InfluxDB | Token API | vacío ⇒ drenado inactivo | Para histórico/envío |
| `INFLUX_ORG` | InfluxDB | Organización | default `museo_smart` | No |
| `INFLUX_BUCKET` | InfluxDB | Bucket | default `museo_smart_ambiental` | No |
| `INFLUX_LOTE` | InfluxDB | Tamaño de lote | default `100` | No |
| `INFLUX_REINTENTO_SEGUNDOS` | InfluxDB | Backoff | default `30` | No |
| `INFLUX_MAX_INTENTOS` | InfluxDB | Máx. reintentos | default `10` | No |
| `INFLUX_INTERVALO_MS` | InfluxDB | Intervalo de barrido | default `15000` | No |
| `MUSEO_SUPERADMIN_EMAIL` | Bootstrap | Correo del primer SuperAdmin | vacío | Opcional |
| `MUSEO_SUPERADMIN_PASSWORD` | Bootstrap | Contraseña inicial | vacío (mín. 8) | Opcional |
| `MUSEO_SUPERADMIN_NOMBRE` | Bootstrap | Nombre | default `SuperAdministrador` | No |

**Estado:** `DB_PASSWORD` y `JWT_SECRET` estaban definidos en el entorno de
usuario de este equipo (longitudes 14 y 44). No se transcriben. `MUSEO_SUPERADMIN_*`
no estaban definidos.

### 2.2 Docker Compose (`docker/.env`)

| Variable | Servicio | Uso | Valor en `.env.example` | Obligatoria |
|---|---|---|---|---|
| `TZ` | Node-RED | Zona horaria | `America/Bogota` | No |
| `NODERED_HOST_PORT` | Node-RED | Puerto host | `1881` | No |
| `MQTT_HOST_PORT` | Mosquitto | Puerto host | `1884` | No |
| `REDIS_HOST_PORT` | Redis | Puerto host | `6380` | No |
| `INFLUX_HOST_PORT` | InfluxDB | Puerto host | `8087` | No |
| `MQTT_USERNAME` | Mosquitto | Usuario | `museo` (ejemplo) | **Sí** |
| `MQTT_PASSWORD` | Mosquitto | Contraseña | `cambia-esta-clave-mqtt` (ejemplo) | **Sí** |
| `REDIS_PASSWORD` | Redis | Contraseña | `cambia-esta-clave-redis` (ejemplo) | **Sí** |
| `INFLUX_USERNAME` | InfluxDB | Usuario admin | `museo-admin` (ejemplo) | **Sí** |
| `INFLUX_PASSWORD` | InfluxDB | Contraseña | `cambia-esta-clave-influx` (ejemplo) | **Sí** |
| `INFLUX_ORG` | InfluxDB | Org | `museo_smart` | **Sí** |
| `INFLUX_BUCKET` | InfluxDB | Bucket | `museo_smart_ambiental` | **Sí** |
| `INFLUX_TOKEN` | InfluxDB | Token | `cambia-este-token-influx-largo-y-aleatorio` | **Sí** |

Diferencias verificadas entre `.env` local y `.env.example`: `MQTT_PASSWORD`,
`INFLUX_PASSWORD` e `INFLUX_TOKEN` tienen valores propios (no se muestran).

### 2.3 Frontend

| Variable | Uso | Valor | Obligatoria |
|---|---|---|---|
| `VITE_MOCK_AUTH` | Activa mocks de auth | `false` en `.env.local` | No |
| `VITE_API_BASE_URL` | Base de la API | no definida ⇒ `/api/v1` | No |
| `VITE_BACKEND_URL` | Destino del proxy Vite | no definida ⇒ `http://localhost:8080` | No (solo dev) |

---

## 3. Puertos

| Puerto | Servicio | Archivo | Configurable |
|---|---|---|---|
| `8080` | Backend Spring Boot | `application.properties` / `SERVER_PORT` | Sí |
| `5432` | PostgreSQL | `spring.datasource.url` / `DB_URL` | Sí |
| `5173` | Vite dev (por defecto) | — | Sí (`--port`) |
| `1880` | Node-RED interno | `docker-compose.yml` | No (interno) |
| `1881` | Node-RED host | `.env` | Sí |
| `1883` | Mosquitto interno | `compose`/`mosquitto.conf` | No (interno) |
| `1884` | Mosquitto host | `.env` | Sí |
| `6379` | Redis interno | Compose | No (interno) |
| `6380` | Redis host | `.env` | Sí |
| `8086` | InfluxDB interno | Compose | No (interno) |
| `8087` | InfluxDB host | `.env` | Sí |

---

## 4. Servicios y contenedores

| Compose service | Imagen | Contenedor | Volúmenes | Healthcheck |
|---|---|---|---|---|
| `mosquitto` | `eclipse-mosquitto:2.0.20` | `museosmart-mosquitto` | `mosquitto_data`, `mosquitto_log`, config y entrypoint | `mosquitto_pub` autenticado |
| `nodered` | `nodered/node-red:4.0.9` | `museosmart-nodered` | `nodered_data`, `./nodered` ro | HTTP 200 en `:1880` |
| `redis` | `redis:7.4.1` | `museosmart-redis` | `redis_data` (AOF) | `redis-cli ping` |
| `influxdb` | `influxdb:2.7.11` | `museosmart-influxdb` | `influxdb_data`, `influxdb_config` | `/health` |

- Red única `museosmart-iot` (bridge).
- `restart: unless-stopped` en los cuatro.
- `nodered` depende de `mosquitto` con `condition: service_healthy`.
- **No hay healthcheck para el backend ni para el frontend** porque no están en
  Compose.
- **Persistencia**: PostgreSQL está fuera de Compose (no hay volumen de base de
  datos en el proyecto actual).

---

## 5. Dependencias

### 5.1 Backend (Maven)

Spring Boot 3.3.4 (Web, Data JPA, Security, Validation, Actuator, Mail),
Flyway core + PostgreSQL, driver PostgreSQL, Paho MQTT 1.2.5,
influxdb-client-java 7.2.0, springdoc 2.6.0, JJWT 0.12.6
(api/impl/jackson), spring-boot-starter-test y spring-security-test.

### 5.2 Frontend (npm)

Runtime: `@react-three/drei`, `@react-three/fiber`, `react`, `react-dom`,
`three`.
Desarrollo: `@gltf-transform/cli`, `@types/react`, `@types/react-dom`,
`@vitejs/plugin-react`, `oxlint`, `vite`.

> `three-stdlib` aparece instalado (2.36.1) como dependencia transitiva y es
> usado por `test-loader.mjs`; no está declarado en `package.json`.

---

## 6. Usuarios iniciales y mecanismos de creación

| Concepto | Existe | Mecanismo |
|---|---|---|
| Usuario en migraciones SQL | **No** | V5 lo indica explícitamente: no se insertan credenciales |
| SuperAdmin automático | Condicional | `SuperAdminInitializer` si `MUSEO_SUPERADMIN_*` y tabla vacía |
| Administradores adicionales | Sí | `POST /api/v1/admin/usuarios` (solo SUPERADMIN) |
| Visitantes | No son usuarios | `sesion_anonima_id` opaco en `sessionStorage` |
| Credenciales de base de datos | Sí (dev) | `postgres/postgres` por defecto en properties |
| Credenciales de MQTT | Sí (dev) | `.env` + `passwd` generado en runtime |
| Credenciales de InfluxDB | Sí (dev) | `.env` |
| Credenciales SMTP | No por defecto | `MAIL_*` |

Base local inspeccionada (solo lectura): 4 filas en `usuario_admin`
(1 SUPERADMIN activo, 2 ADMIN activos, 1 ADMIN inactivo). **No se dispone de sus
contraseñas**; no se documentan sus correos.

Verificación de login: no ejecutada (sin credenciales). El mecanismo está
verificado en código y por los tests `AuthServiceTest` / `AdminSecurityControllerTest`.

---

## 7. Datos que debe aportar el desarrollador que instala

1. Contraseña de PostgreSQL y nombre de base (`Museo_Smart`).
2. `JWT_SECRET` aleatorio ≥32 caracteres
   (p. ej. `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))`).
3. Credenciales MQTT propias (usuario + contraseña) para `docker/.env` y para
   el nodo broker de Node-RED.
4. Contraseña de administrador de InfluxDB y token de API.
5. Correo y contraseña de aplicación de Gmail **solo si** desea recuperación
   real por correo.
6. Correo y contraseña temporal para el primer SuperAdmin (o crearlo después
   vía API con otro SUPERADMIN; recuerde que el bootstrap exige tabla vacía).

---

## 8. Secretos y su tratamiento

| Secreto | Ubicación actual | Riesgo | Recomendación |
|---|---|---|---|
| `DB_PASSWORD` | Entorno del autor; default `postgres` en properties | Alto en producción | Variable de entorno obligatoria |
| `JWT_SECRET` | Entorno del autor | Alto | Variable de entorno ≥32 chars |
| `MQTT_PASSWORD` | `docker/.env` (no versionado) | Medio | Mantener fuera de git |
| `INFLUX_TOKEN` / `INFLUX_PASSWORD` | `docker/.env` (no versionado) | Medio | Mantener fuera de git |
| `REDIS_PASSWORD` | `docker/.env` | Bajo (Redis sin uso) | Igual |
| `MAIL_PASSWORD` | Entorno (solo si se habilita) | Alto | Variable de entorno |
| `MUSEO_SUPERADMIN_PASSWORD` | Entorno al primer arranque | Alto | Definir solo una vez y cambiarla al entrar |
| Mocks de auth (`authApiMock.js`) | Código versionado | Bajo | Credenciales ficticias; no son secretos reales |

No se encontraron claves privadas, certificados ni tokens reales dentro del
código versionado. `docker/.env` y `docker/mosquitto/config/passwd` están
ignorados por git y **no están trackeados** (verificado con `git ls-files`).

---

## 9. Plantilla segura de `.env` (nueva, propuesta)

No reemplaza archivos existentes. Contenido sugerido para un `.env` local:

```env
# --- Backend ---
SERVER_PORT=8080
DB_URL=jdbc:postgresql://localhost:5432/Museo_Smart
DB_USERNAME=postgres
DB_PASSWORD=CAMBIA_ESTO
JWT_SECRET=CAMBIA_ESTO_POR_32_O_MAS_CARACTERES_ALEATORIOS
JWT_EXPIRACION_MINUTOS=60

# --- Primer administrador (solo si la tabla está vacía) ---
MUSEO_SUPERADMIN_EMAIL=tu-correo@dominio.com
MUSEO_SUPERADMIN_PASSWORD=CAMBIA_ESTO_MIN_8
MUSEO_SUPERADMIN_NOMBRE=SuperAdministrador

# --- MQTT / InfluxDB (deben coincidir con docker/.env) ---
MQTT_BROKER_URL=tcp://localhost:1884
MQTT_USERNAME=museo
MQTT_PASSWORD=CAMBIA_ESTO
INFLUX_URL=http://localhost:8087
INFLUX_TOKEN=CAMBIA_ESTO
INFLUX_ORG=museo_smart
INFLUX_BUCKET=museo_smart_ambiental

# --- Correo (opcional) ---
APP_MAIL_HABILITADO=false
APP_MAIL_FROM=
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
```
