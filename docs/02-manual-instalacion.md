# Documento 2. Manual de instalaciÃ³n y ejecuciÃ³n

> Este manual distingue tres modalidades reales del repositorio:
>
> - **A. Completamente local**: PostgreSQL nativo + backend Maven + Vite.
> - **B. Local con servicios auxiliares en Docker**: el modo que el proyecto
>   soporta hoy (Compose solo contiene Mosquitto, Node-RED, Redis e InfluxDB).
> - **C. Completamente contenerizada**: **no existe** todavÃ­a. La propuesta estÃ¡
>   en [propuesta-docker/](propuesta-docker/) y es material nuevo, no probado.
>
> Los comandos de las secciones A y B corresponden a archivos y herramientas
> realmente presentes. En C se indica expresamente quÃ© es nuevo.

---

## 1. Requisitos

### 1.1 Hardware

El proyecto no declara requisitos mÃ­nimos. SegÃºn los recursos que consume:

| Recurso | MÃ­nimo razonable | ObservaciÃ³n |
|---|---|---|
| RAM | 8 GB | Backend JVM + Vite + PostgreSQL + 4 contenedores |
| Disco | 4 GB libres | Modelo GLB duplicado (128 MB), `node_modules`, `.m2`, volÃºmenes Docker |
| CPU | 2 nÃºcleos | El visor 3D con WebGL se beneficia de GPU |
| GPU | Opcional | El recorrido 3D requiere WebGL en el navegador |

> Es una estimaciÃ³n, no un requisito escrito en el repositorio.

### 1.2 Software

| Herramienta | VersiÃ³n verificada / compatible | Uso |
|---|---|---|
| JDK | **21** (obligatorio por `java.version`) | backend |
| Maven | 3.9.9 (wrapper `only-script`, descarga la distribuciÃ³n) o Maven instalado | backend |
| Node.js | `^20.19.0 || >=22.12.0` (requisito de Vite 8) â€” probado con 24.15.0 | frontend |
| npm | 11.x (probado 11.12.1) | frontend |
| PostgreSQL | 16.x (probado 16.15) | base de datos |
| Docker Desktop | versiÃ³n reciente con Compose v2 (probado 29.8.0 / Compose v5.5.1) | servicios IoT |
| Navegador | con WebGL 2 para el recorrido | frontend |

Opcionales: `psql`, MQTTX (cliente MQTT), Gmail con contraseÃ±a de aplicaciÃ³n.

### 1.3 ComprobaciÃ³n rÃ¡pida

```powershell
java -version            # debe decir 21
node -v                  # 20.19+ o 22.12+
npm -v
docker --version
docker compose version
```

En Windows, si `java -version` no muestra 21, defina `JAVA_HOME` apuntando al
JDK 21 antes de ejecutar Maven.

---

## 2. Obtener el proyecto

```powershell
git clone https://github.com/Gabimoralest/Museo_Smart.git
Set-Location Museo_Smart
```

El remoto configurado en el repositorio es
`https://github.com/Gabimoralest/Museo_Smart.git` (verificado con `git remote -v`).

> El modelo 3D de 64 MB estÃ¡ versionado dos veces; la clonaciÃ³n serÃ¡ lenta.

---

## 3. OpciÃ³n B (recomendada por el estado actual): servicios IoT en Docker + backend/frontend locales

### 3.1 Preparar variables de Docker

```powershell
Set-Location docker
Copy-Item .env.example .env
notepad .env
```

Complete como mÃ­nimo `MQTT_USERNAME`, `MQTT_PASSWORD`, `REDIS_PASSWORD`,
`INFLUX_USERNAME`, `INFLUX_PASSWORD`, `INFLUX_TOKEN` con valores propios.
`INFLUX_TOKEN` debe ser una cadena larga y aleatoria (el ejemplo advierte que no
use el valor de plantilla).

### 3.2 Levantar la infraestructura

```powershell
docker compose config      # valida el archivo y resuelve variables
docker compose up -d
docker compose ps          # debe mostrar 4 servicios; mosquitto/nodered/redis/influxdb
docker compose logs -f     # Ctrl+C para salir de los logs
```

Servicios y puertos del host (valores por defecto de `.env.example`):

| Servicio | Contenedor | Host â†’ contenedor |
|---|---|---|
| Node-RED | `museosmart-nodered` | `1881 â†’ 1880` |
| Mosquitto | `museosmart-mosquitto` | `1884 â†’ 1883` |
| Redis | `museosmart-redis` | `6380 â†’ 6379` |
| InfluxDB | `museosmart-influxdb` | `8087 â†’ 8086` |

VerificaciÃ³n:

```powershell
docker compose ps
# Alternativa sin cliente MQTT:
Test-NetConnection localhost -Port 1884
Invoke-WebRequest http://localhost:8087/health -UseBasicParsing
```

Node-RED: abrir `http://localhost:1881`. El flujo `Simulador de Sensores MQTT`
debe estar desplegado y conectado al broker `mosquitto:1883`.

> **Credenciales MQTT en Node-RED**: el nodo `mqtt-broker` del flujo exportado
> **no contiene usuario ni contraseÃ±a** en `museo-smart-flows.json` (se
> verificaron sus propiedades). El broker tiene `allow_anonymous false`, por lo
> que, tal como estÃ¡ el archivo, Node-RED no podrÃ¡ autenticarse hasta que se
> configuren las credenciales en la UI (pestaÃ±a *Credentials*) del nodo.
> Ver documento 04.

### 3.3 Preparar PostgreSQL nativo

1. Crear la base (nombre exacto, sensible a mayÃºsculas en la URL):

```sql
CREATE DATABASE "Museo_Smart";
```

2. No hay que crear tablas: Flyway aplica `V1â€¦V10` al arrancar el backend.

### 3.4 Configurar y arrancar el backend

OpciÃ³n automÃ¡tica (Windows):

```powershell
Set-Location backend
.\iniciar-museo.ps1
```

El script:

- exige JDK 21: comprueba `JAVA_HOME` y, si no es válido, recurre a
  `C:\Users\Gaby\AppData\Local\Programs\jdk-21.0.12.1+1`; esa ruta es específica
  del autor y debe ajustarse en otro equipo;
- construye `DB_URL` con `DB_HOST/DB_PORT/DB_NAME` (por defecto
  `localhost/5432/Museo_Smart`);
- pide `DB_PASSWORD`, `JWT_SECRET`, `MAIL_PASSWORD`, `MQTT_PASSWORD` e
  `INFLUX_TOKEN` de forma segura si no estÃ¡n en el entorno;
- lee `..\docker\.env` como respaldo para MQTT e InfluxDB;
- fuerza `MQTT_BROKER_URL=tcp://localhost:1884` e
  `INFLUX_URL=http://localhost:8087`;
- comprueba que el puerto 8080 estÃ© libre y aborta si falta configuraciÃ³n MQTT;
- arranca `mvnw.cmd spring-boot:run`.

OpciÃ³n manual:

```powershell
Set-Location backend
$env:JAVA_HOME = "C:\ruta\a\jdk-21"
$env:DB_URL = "jdbc:postgresql://localhost:5432/Museo_Smart"
$env:DB_USERNAME = "postgres"
$env:DB_PASSWORD = "TU_PASSWORD"
$env:JWT_SECRET = "una-cadena-aleatoria-de-32-o-mas-caracteres"
$env:MQTT_USERNAME = "museo"
$env:MQTT_PASSWORD = "TU_PASSWORD_MQTT"
$env:INFLUX_TOKEN = "TU_TOKEN_INFLUX"
$env:INFLUX_ORG = "museo_smart"
$env:INFLUX_BUCKET = "museo_smart_ambiental"
.\mvnw.cmd spring-boot:run
```

Alternativa con el JAR ya compilado:

```powershell
.\mvnw.cmd -DskipTests package
java -jar target\museo-smart-backend-0.0.1-SNAPSHOT.jar
```

> El JAR incluido en `target/` fue empaquetado el 15/10/2026 y **no contiene
> `V10__presencia_actual_sensor.sql`** (se verificÃ³ el contenido del JAR). Si
> usa el JAR existente contra una base nueva, ejecute `mvn package` antes para
> incluir V10, o aplique la migraciÃ³n manualmente.

Comprobar:

```powershell
Invoke-WebRequest http://localhost:8080/actuator/health -UseBasicParsing   # {"status":"UP"}
Invoke-WebRequest http://localhost:8080/api/v1/salas -UseBasicParsing
Start-Process http://localhost:8080/swagger-ui/index.html
```

### 3.5 Crear el primer administrador

No existe usuario en migraciones. Dos caminos:

**a) Bootstrap automÃ¡tico** (recomendado la primera vez): definir antes de
arrancar

```powershell
$env:MUSEO_SUPERADMIN_EMAIL = "tu-correo@dominio.com"
$env:MUSEO_SUPERADMIN_PASSWORD = "ContrasenaTemporal123"
$env:MUSEO_SUPERADMIN_NOMBRE = "SuperAdministrador"
```

Se crea **solo si** `usuario_admin` estÃ¡ vacÃ­a y la contraseÃ±a tiene â‰¥8
caracteres, con rol `SUPERADMIN`, estado `ACTIVO` y
`primer_inicio_sesion=true`. El primer login obliga a cambiar la contraseÃ±a
antes de usar rutas administrativas (salvo `/admin/alertas`, ver doc. 04).

**b) SQL manual** con un hash BCrypt generado aparte. No se recomienda porque
requiere producir el hash correcto; el proyecto no incluye un inicializador
alternativo.

### 3.6 Arrancar el frontend

```powershell
Set-Location frontend
npm install
npm run dev
```

Abrir `http://localhost:5173` (puerto por defecto de Vite; el repositorio no lo
fija). El proxy reenvÃ­a `/api` a `http://localhost:8080`.

`.env.local` ya existe con `VITE_MOCK_AUTH=false`. No lo copie desde el repo en
otro equipo: **estÃ¡ ignorado por git** y no se clona. Si no existe, se crea:

```env
VITE_MOCK_AUTH=false
# VITE_API_BASE_URL=/api/v1
# VITE_BACKEND_URL=http://localhost:8080
```

Build de producciÃ³n:

```powershell
npm run build      # genera dist/
npm run preview    # sirve dist/ para probar
```

El `dist/` resultante contiene solo archivos estáticos; necesita un servidor web
que además haga proxy de `/api` y `/media` al backend (ver propuesta Docker) porque no hay
CORS y los archivos subidos se sirven bajo `/media/**`.

#### Configuración de Proxy Inverso en producción (Caddy / Nginx)

En producción, el reverse proxy debe reenviar tanto `/api` como `/media` al backend Spring Boot:
- `/api/**`: Endpoints de la API REST.
- `/media/**`: Archivos multimedia subidos (imágenes y videos). Si no se redirige `/media`, las imágenes y videos aparecerán rotos (404).
- Tamaño máximo de carga: Permitir al menos 55 MB para subidas de video de hasta 50 MB.

**Ejemplo Nginx (`frontend/nginx.conf`):**
```nginx
client_max_body_size 55M;

location /api/ {
    proxy_pass http://backend:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /media/ {
    proxy_pass http://backend:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

**Ejemplo Caddy (`Caddyfile`):**
```caddyfile
:80 {
    root * /usr/share/caddy
    file_server

    # Reenvío de API y multimedia al backend Spring Boot
    @backend path /api/* /media/*
    handle @backend {
        request_body {
            max_size 55MB
        }
        reverse_proxy backend:8080
    }

    # SPA fallback
    try_files {path} /index.html
}
```

---

## 4. OpciÃ³n A: todo local sin Docker

1. Instalar y arrancar PostgreSQL 16 y crear `Museo_Smart`.
2. Instalar Mosquitto 2.x nativo y un cliente Node-RED nativo (no incluidos en
   el repo; el flujo sÃ­ estÃ¡).
3. Configurar el broker para autenticaciÃ³n, o definir un broker alternativo y
   ajustar `MQTT_BROKER_URL` (la aplicaciÃ³n solo lee esa URL; el host/puerto es
   libre).
4. Instalar InfluxDB 2.x, crear org/bucket y definir `INFLUX_URL`,
   `INFLUX_TOKEN`, `INFLUX_ORG`, `INFLUX_BUCKET`.
5. Deshabilitar los mÃ³dulos que no tenga: `MQTT_ENABLED=false`,
   `INFLUX_ENABLED=false`. Con eso el backend arranca sin ellos y conserva las
   mediciones en PostgreSQL.
6. Seguir 3.3â€“3.6 con las URLs/credenciales correspondientes.

> En este modo los scripts de `docker/` no se usan. El flujo de Node-RED apunta
> al host `mosquitto`, que solo resuelve dentro de la red de Compose; habrÃ­a que
> cambiar el broker a `localhost` en la UI.

---

## 5. OpciÃ³n C: contenerizaciÃ³n completa (propuesta nueva)

Ver [propuesta-docker/README.md](propuesta-docker/README.md). Es una propuesta
coherente con el cÃ³digo, **no aplicada ni probada**. Incluye:

- `Dockerfile` multi-stage para el backend (Maven + JRE 21).
- `Dockerfile` multi-stage para el frontend (Node + Nginx).
- `nginx.conf` con proxy `/api` al backend y fallback SPA.
- `compose.full.yml` con PostgreSQL, backend, frontend, Mosquitto, Node-RED,
  InfluxDB y (opcional) Redis.
- `.env.full.example`.
- Notas de migraciÃ³n y de comunicaciÃ³n entre contenedores.

---

## 6. Verificaciones posteriores al arranque

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | `GET http://localhost:8080/actuator/health` | `{"status":"UP"}` |
| 2 | `GET /api/v1/salas` | 4 salas |
| 3 | `GET /api/v1/exhibiciones` | 8 exhibiciones activas en una base recién migrada |
| 4 | `GET /api/v1/exhibiciones/1` | objeto o 404 si estÃ¡ inactiva |
| 5 | `GET /api/v1/admin/exhibiciones` sin token | `401` |
| 6 | Login en `#/login` | `200` + sesiÃ³n; redirige a `#/admin` |
| 7 | `GET /api/v1/admin/monitoreo/sensores` con token | 12 sensores |
| 8 | `GET /api/v1/admin/monitoreo/lecturas-recientes` con token | lecturas (si MQTT activo) |
| 9 | `GET /api/v1/admin/monitoreo/resumen` con token | totales y promedios |
| 10 | `GET /api/v1/admin/monitoreo/historico?...` con token y token Influx | series o `400` si Influx no estÃ¡ configurado |
| 11 | `GET /api/v1/admin/monitoreo/salud-outbox` con token | contadores PENDIENTE/ENVIADO/ERROR |
| 12 | `POST /api/v1/popularidad/visitas` | `201 {registrada:true}` la primera vez |
| 13 | Node-RED UI | `http://localhost:1881` carga |
| 14 | InfluxDB UI | `http://localhost:8087` carga |
| 15 | Frontend | portada, modal de sala, fichas, recorrido 3D |

Ejemplo de autenticaciÃ³n por consola:

```powershell
$body = @{ correo = "TU_CORREO"; contrasena = "TU_CLAVE" } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/v1/auth/login -ContentType "application/json" -Body $body
$h = @{ Authorization = "Bearer $($login.token)" }
Invoke-RestMethod -Uri http://localhost:8080/api/v1/admin/monitoreo/resumen -Headers $h
```

---

## 7. Apagado y reinicio

```powershell
# Backend/frontend: Ctrl+C en sus terminales.

# Servicios IoT sin perder datos (conserva volÃºmenes):
Set-Location docker
docker compose stop          # detiene y conserva contenedores/volÃºmenes
docker compose down          # elimina contenedores/red, CONSERVA volÃºmenes
docker compose start         # vuelve a arrancar
docker compose restart       # reinicia
docker compose logs -f --tail 100
```

> **Advertencia**: `docker compose down -v` **elimina los volÃºmenes**
> (`museosmart_mosquitto_data`, `museosmart_nodered_data`,
> `museosmart_redis_data`, `museosmart_influxdb_data`, â€¦) y con ellos el estado
> de Node-RED y el histÃ³rico de InfluxDB. No lo use salvo que quiera borrar los
> datos. PostgreSQL no estÃ¡ en Compose, asÃ­ que este comando **no** afecta a
> `Museo_Smart`.

---

## 8. SoluciÃ³n de errores frecuentes

| SÃ­ntoma | Causa probable | Archivo a revisar | SoluciÃ³n |
|---|---|---|---|
| `Communications link failure` / `Connection refused` al arrancar | PostgreSQL apagado o credenciales incorrectas | `application.properties`, `DB_*` | Arrancar PostgreSQL, crear `Museo_Smart`, ajustar `DB_PASSWORD` |
| `Schema-validation: missing table â€¦` | Flyway deshabilitado o base incorrecta | `spring.flyway.*`, `DB_URL` | No desactivar Flyway; usar la base correcta |
| Flyway `Schema "public" has a version (10) that is newer than the latest available migration (9)` | JAR antiguo sin V10 contra base ya migrada | `target/*.jar` | Recompilar con `mvn package`; la advertencia no impide arrancar |
| `JWT_SECRET no configurado` en log | Falta el secreto | `application.properties` | Definir `JWT_SECRET` â‰¥32 caracteres |
| Login devuelve 401 con credenciales correctas | No existe usuario / cuenta no ACTIVO / otro `JWT_SECRET` invalidÃ³ tokens | `usuario_admin` | Crear SuperAdmin con bootstrap; revisar estado |
| 403 â€œDebe cambiar su contraseÃ±aâ€¦â€ | `primer_inicio_sesion=true` | `PrimerInicioSesionFilter` | Cambiar la contraseÃ±a en Mi perfil |
| Frontend muestra â€œNo pudimos conectar con el servidorâ€ | Backend apagado, puerto distinto o proxy mal configurado | `vite.config.js`, `httpClient.js` | Arrancar backend en 8080 o ajustar `VITE_BACKEND_URL` |
| Errores CORS al servir `dist/` en otro puerto | No hay CORS en el backend | `SecurityConfig` | Servir frontend y API bajo el mismo origen o poner proxy |
| MQTT no conecta (`MqttSecurityException`) | Faltan usuario/contraseÃ±a o el broker no estÃ¡ arriba | `application.properties`, `docker/.env` | Definir `MQTT_USERNAME/PASSWORD`, `docker compose up -d` |
| Node-RED no publica | Credenciales del nodo broker vacÃ­as o broker inaccesible | `museo-smart-flows.json` | Configurar credenciales en la UI; verificar `mosquitto` en la red |
| InfluxDB devuelve 400 en histÃ³rico | `INFLUX_TOKEN` vacÃ­o | `application.properties`, `IotInfluxProperties` | Definir token; sin Ã©l el endpoint responde â€œInfluxDB no estÃ¡ configuradoâ€ |
| `medicion_pendiente` crece sin lÃ­mite | No hay purga de ENVIADO | `OutboxDrenadorInflux` | Programa una purga por retenciÃ³n (no existe en el cÃ³digo) |
| `npm run dev` falla por versiÃ³n de Node | Node < 20.19 / 22.12 | `package.json` | Actualizar Node |
| Puerto 8080/1881/1884/8087/6380 ocupado | Otro servicio local | `.env`, `SERVER_PORT` | Cambiar puertos de host en `.env` o `SERVER_PORT` |
| `docker compose` falla por variables no definidas | No existe `docker/.env` | `docker/.env.example` | `Copy-Item .env.example .env` y completar |
| El recorrido 3D no carga | GLB grande, WebGL no disponible o ruta base distinta | `museo3d.js`, `public/` | Probar en navegador con WebGL; servir desde la raÃ­z |

---

## 9. Diferencias entre modalidades

| Aspecto | A. Local | B. Local + Docker IoT | C. Todo Docker (propuesta) |
|---|---|---|---|
| PostgreSQL | nativo | nativo | contenedor |
| Backend | `mvnw` / JAR | `mvnw` / JAR | contenedor |
| Frontend | Vite | Vite | Nginx |
| MQTT/Node-RED/Influx | nativo | Docker | Docker |
| Redis | no usado | contenedor sin uso | opcional, sin uso |
| Complejidad | alta | media | baja una vez construida |
| Estado en el repo | soportado | **soportado y documentado** | **solo propuesta** |
