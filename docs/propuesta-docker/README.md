# Propuesta de contenerización completa

> **Todo este directorio es material nuevo.** El repositorio no tenía
> `Dockerfile`, ni `nginx.conf`, ni un Compose con PostgreSQL/backend/frontend.
> Lo que ya existía es únicamente `docker/docker-compose.yml` con Mosquitto,
> Node-RED, Redis e InfluxDB.
>
> Este diseño **no se ha ejecutado** (el daemon de Docker no estaba activo
> durante la auditoría). Se apoya en el código real: variables de
> `application.properties`, comandos de `package.json`, healthcheck de Actuator y
> el esquema Flyway V1–V10.

## Contenido

| Archivo | Destino sugerido en el repo | Función |
|---|---|---|
| `backend.Dockerfile` | `backend/Dockerfile` | Build Maven + JRE 21 |
| `frontend.Dockerfile` | `frontend/Dockerfile` | Build Vite + Nginx |
| `nginx.conf` | `frontend/nginx.conf` | SPA + proxy `/api` al backend |
| `compose.full.yml` | `docker/compose.full.yml` | Stack completo |
| `.env.full.example` | `docker/.env.full.example` | Variables del stack |

Sugerencia adicional (no incluida como archivo para no añadir ruido):
`backend/.dockerignore` y `frontend/.dockerignore` con
`target/`, `node_modules/`, `dist/`, `.env*`, `*.glb` (salvo el optimizado que se
sirve desde `public/`).

## Cómo se comunican los contenedores

- Todos los servicios están en la red `museosmart` (bridge).
- El backend usa nombres de servicio, **nunca `localhost`**:
  - `jdbc:postgresql://postgres:5432/Museo_Smart`
  - `tcp://mosquitto:1883`
  - `http://influxdb:8086`
- El frontend (Nginx) resuelve `http://backend:8080` para `/api/`.
- Node-RED resuelve el broker como `mosquitto:1883` (ya está así en el flujo).
- `localhost` dentro de un contenedor apunta al propio contenedor. Por eso el
  `application.properties` con `localhost:1884/8087` se sobrescribe en el
  Compose con los nombres de servicio.

## Por qué se cambian puertos

- El frontend publica `8080` en el host porque el backend ya no ocupa ese puerto
  en el host (se publica en `8081` solo para Swagger).
- PostgreSQL se publica en `5433` para no chocar con PostgreSQL nativo en `5432`.
- Los puertos internos no se tocan.

## Inicialización de PostgreSQL y migraciones

1. `/var/lib/postgresql/data` se respalda en el volumen
   `museosmart_postgres_data`.
2. El healthcheck `pg_isready` bloquea el arranque del backend hasta que la base
   acepta conexiones.
3. Al arrancar, Flyway aplica `V1…V10` (incluida V10, siempre que la imagen se
   construya desde el código actual; el JAR viejo de `target/` no la contiene).
4. No hace falta montar scripts: las migraciones van dentro del JAR.

## Persistencia

| Dato | Volumen |
|---|---|
| PostgreSQL | `museosmart_postgres_data` |
| InfluxDB | `museosmart_influxdb_data` + `museosmart_influxdb_config` |
| Node-RED (flujos y credenciales) | `museosmart_nodered_data` |
| Mosquitto | `museosmart_mosquitto_data` + `museosmart_mosquitto_log` |

Detener sin perder datos:

```powershell
docker compose --env-file .env.full -f compose.full.yml stop
docker compose --env-file .env.full -f compose.full.yml down      # conserva volúmenes
docker compose --env-file .env.full -f compose.full.yml logs -f
```

> **`down -v` borra la base de datos y el histórico de InfluxDB.** Úselo solo
> para un reinicio limpio deliberado.

## Arranque desde cero

```powershell
Set-Location docker
Copy-Item .env.full.example .env.full
notepad .env.full       # rellene todos los CAMBIA_ESTO

# Copiar los archivos de esta propuesta a sus destinos
Copy-Item ..\docs\propuesta-docker\backend.Dockerfile ..\backend\Dockerfile
Copy-Item ..\docs\propuesta-docker\frontend.Dockerfile ..\frontend\Dockerfile
Copy-Item ..\docs\propuesta-docker\nginx.conf ..\frontend\nginx.conf
Copy-Item ..\docs\propuesta-docker\compose.full.yml .\compose.full.yml

docker compose --env-file .env.full -f compose.full.yml config
docker compose --env-file .env.full -f compose.full.yml up -d --build
docker compose --env-file .env.full -f compose.full.yml ps
```

Acceso: `http://localhost:8080` (aplicación), `http://localhost:8081/swagger-ui/index.html`,
`http://localhost:1881` (Node-RED), `http://localhost:8087` (InfluxDB).

## Verificación por servicio

```powershell
docker compose --env-file .env.full -f compose.full.yml ps
curl http://localhost:8080/actuator/health
curl http://localhost:8080/api/v1/salas
docker exec museosmart-postgres psql -U postgres -d Museo_Smart -c "select version, success from flyway_schema_history order by installed_rank;"
docker exec museosmart-mosquitto mosquitto_sub -h localhost -u museo -P 'TU_CLAVE' -t 'museo/sensores/#' -C 2 -W 15
docker exec museosmart-redis redis-cli -a 'TU_CLAVE' ping      # solo si se descomenta Redis
curl http://localhost:8087/health
```

## Configuración de Node-RED

El flujo exportado **no incluye credenciales** del broker. Tras el primer
arranque:

1. Abrir `http://localhost:1881`.
2. Editar el nodo “Mosquitto Docker (mosquitto:1883)”.
3. Pestaña *Security*: usuario y contraseña iguales a `MQTT_USERNAME/PASSWORD`.
4. Desplegar y comprobar que los 12 mensajes se publican cada 5 s.

## Limitaciones conocidas de esta propuesta

- No incluye TLS; para exposición pública añadir un proxy con certificados.
- No añade purga del outbox (`medicion_pendiente`).
- No modifica el código: los defectos del documento 04 siguen presentes.
- No se ha probado en ejecución.
