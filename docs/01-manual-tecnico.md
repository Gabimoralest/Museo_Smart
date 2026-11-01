# Documento 1. Manual técnico de Museo_Smart

> Basado en lectura directa del código y en ejecuciones locales indicadas en
> [README.md](README.md). Cuando algo es inferencia o no se pudo verificar, se
> indica expresamente.

---

## 1. Descripción general

**Museo_Smart** es un museo virtual con tres bloques funcionales claramente
separados en el código:

1. **Sitio público**: portada con cuatro salas fijas, fichas de exhibiciones y
   un recorrido 3D navegable sobre un modelo GLB.
2. **Panel administrativo** (SPA con rutas hash): exhibiciones, monitoreo IoT,
   alertas, popularidad, administradores y perfil.
3. **Ingesta IoT**: sensores simulados publicados por MQTT (Node-RED/Mosquitto),
   consumidos por Spring Boot, persistidos en PostgreSQL y drenados a InfluxDB
   mediante un patrón *outbox*.

### 1.1 Funcionalidades implementadas (verificadas)

| Área | Estado | Evidencia |
|---|---|---|
| Autenticación JWT de administradores | Implementada | `AuthController`, `AuthService`, `JwtService` |
| Recuperación de contraseña por código | Implementada en backend; envío real depende de SMTP | `PasswordResetController`, `PasswordResetService`, `SmtpMailService` |
| Consulta pública de salas y exhibiciones | Implementada | `SalaController`, `ExhibicionController` |
| Activación/desactivación de exhibiciones con historial | Implementada (solo estado; no alta/edición) | `ExhibicionAdminController`, trigger `trg_exhibicion_historial` |
| Ranking de popularidad con deduplicación | Implementada en PostgreSQL | `PopularidadService`, `VisitaRepository`, vista `v_ranking_exhibicion` |
| Registro anónimo de interacciones | Implementada | `PopularidadController`, `POST /api/v1/popularidad/visitas` |
| Monitoreo IoT (últimas lecturas, promedios, presencia) | Implementada desde PostgreSQL | `MonitoreoController`, `MonitoreoRepository` |
| Histórico de series temporales | Implementada contra InfluxDB 2.x | `MonitoreoService.historico`, `InfluxLector` |
| Outbox de mediciones con reintentos | Implementada | `OutboxDrenadorInflux`, `MedicionEnvioService` |
| Alertas ambientales automáticas con deduplicación | Implementada | `AlertaService` |
| Gestión de administradores | Implementada (solo SUPERADMIN) | `UsuarioAdminController` |
| Recorrido 3D del museo | Implementada visualmente | `RecorridoMuseo.jsx`, `museo3d.js` |
| Vinculación pieza 3D ↔ exhibición del backend | **Pendiente** (todas las entradas `null`) | `frontend/src/data/museo3d.js` |
| Alta/edición de exhibiciones desde la API | **No implementada** | Comentario explícito en `ExhibicionAdminController` |
| Tiempo real / WebSockets | **No implementado** | No hay dependencias ni código WebSocket/SSE/STOMP |
| Uso de Redis | **No implementado** | Redis está en Compose pero el backend no tiene cliente Redis |
| Multimedia (`contenido_multimedia`) | Tabla creada, **sin uso** | Migración V3; no existe entidad ni endpoint |

### 1.2 Simulaciones y datos ficticios que permanecen en el repositorio

| Elemento | Uso real |
|---|---|
| `frontend/src/data/authApiMock.js` | Solo si `VITE_MOCK_AUTH=true`. Hoy `.env.local` tiene `false`. |
| `frontend/src/data/monitoreoData.js`, `alertasData.js`, `popularidadData.js`, `administradoresData.js` | **No se importan** en ningún componente. |
| `frontend/src/data/panelSuperAdmin.js` | Solo se usan `secciones` e `imagenesPanel`. Los arrays de métricas simuladas (`resumenInicio`, `alertasRecientesInicio`, etc.) no se renderizan. |
| `frontend/src/data/exhibicionesData.js` | Solo se usan `imagenExhibicion` y `OPCIONES_*`. El array `exhibicionesIniciales` es legado. |
| `frontend/src/components/ModalIngreso.jsx` | **Código muerto**: no lo importa nadie. |
| `frontend/public/images/exhibiciones/*` | Se usan como imagen decorativa asignada por `id`; el backend no expone imágenes. |
| Node-RED `museo-smart-flows.json` | Simulador real: publica 12 sensores cada 5 s. |

---

## 2. Arquitectura

```
                    ┌───────────────────────────────────────────┐
   Navegador  ─────▶│  Frontend React 19 + Vite 8 (SPA hash)    │
                    │  · sin router ni gestor de estado         │
                    │  · sessionStorage para JWT y sesión anón. │
                    └───────────────┬───────────────────────────┘
                                    │ fetch /api/v1 (proxy en dev)
                                    ▼
                    ┌───────────────────────────────────────────┐
                    │  Backend Spring Boot 3.3.4 (Java 21)      │
                    │  Monolito modular, puerto 8080            │
                    │  Security JWT · JPA · Flyway · Actuator   │
                    └───┬───────────────┬───────────────┬───────┘
                        │ JDBC          │ MQTT (Paho)   │ HTTP (influxdb-client)
                        ▼               ▼               ▼
              ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
              │ PostgreSQL16 │  │  Mosquitto   │  │  InfluxDB 2.7│
              │ Museo_Smart  │  │  2.0.20      │  │  8086        │
              └──────────────┘  └──────▲───────┘  └──────▲───────┘
                                       │ publica          │ escribe
                                ┌──────┴───────┐         │
                                │  Node-RED    │         │
                                │  4.0.9       │         │
                                │ simulador 12 │─────────┘ (solo nodos
                                │ sensores/5 s │            legacy, inactivos)
                                └──────────────┘

              ┌──────────────┐
              │ Redis 7.4.1  │  ← definido en Docker Compose, SIN uso en el código
              └──────────────┘
```

- **Comunicación**: HTTP/JSON entre frontend y backend; MQTT entre Node-RED y
  backend; JDBC a PostgreSQL; HTTP a InfluxDB.
- **No hay** WebSockets, SSE ni colas de mensajes. El panel refresca solo al
  montar cada vista o con acciones del usuario.
- **No hay** CORS configurado: el frontend debe servirse en el mismo origen que
  la API o usar el proxy de Vite (desarrollo, con `/api` y `/media`) / un proxy inverso en producción (Caddy, Nginx reenviando `/api` y `/media` al backend con límite de hasta 55 MB para subidas multimedia).

### 2.1 Tecnologías y versiones

| Componente | Versión declarada | Fuente |
|---|---|---|
| Java | 21 (`java.version`) | `backend/pom.xml` |
| Spring Boot | 3.3.4 | `backend/pom.xml` |
| Spring Security / Data JPA / Validation / Actuator / Mail | gestionadas por el BOM 3.3.4 | `pom.xml` |
| Flyway | gestionada por el BOM (+ `flyway-database-postgresql`) | `pom.xml` |
| PostgreSQL JDBC | gestionada por el BOM (driver 42.7.4 en el `.m2` local) | `pom.xml` |
| Eclipse Paho MQTT | 1.2.5 | `pom.xml` |
| InfluxDB client Java | 7.2.0 | `pom.xml` |
| springdoc OpenAPI | 2.6.0 | `pom.xml` |
| JJWT | 0.12.6 | `pom.xml` |
| React / React DOM | `^19.2.8` (instalado 19.3.0) | `frontend/package.json`, `package-lock.json` |
| Vite | `^8.3.0` (instalado 8.3.4) | idem |
| three / @react-three/fiber / drei | 0.186.1 / 9.8.2 / 10.7.9 | idem |
| Oxlint | `^1.81.0` | idem |
| PostgreSQL (local) | 16.15 | `SELECT version()` vía JDBC y log de Flyway |
| Mosquitto | `eclipse-mosquitto:2.0.20` | `docker/docker-compose.yml` |
| Node-RED | `nodered/node-red:4.0.9` | idem |
| Redis | `redis:7.4.1` | idem |
| InfluxDB | `influxdb:2.7.11` | idem |

> El entorno de este análisis tenía Java 25 como `java` del PATH y JDK 21 en
> `JAVA_HOME`; el backend arrancó correctamente con JDK 21.

### 2.2 Estructura de carpetas

```
Museo_Smart/
├─ backend/                     Spring Boot (Maven)
│  ├─ .mvn/wrapper/             Maven Wrapper 3.3.4 (only-script, sin .jar)
│  ├─ iniciar-museo.ps1         Script de arranque local con validaciones
│  ├─ pom.xml
│  ├─ .env.example              Plantilla de variables del backend
│  └─ src/
│     ├─ main/java/com/museosmart/
│     │  ├─ MuseoSmartApplication.java
│     │  ├─ config/             SecurityConfig, OpenApiConfig, SuperAdminInitializer
│     │  ├─ controller/         10 controladores REST
│     │  ├─ dto/                DTOs y DtoMapper + dto/monitoreo
│     │  ├─ entity/             10 entidades JPA
│     │  ├─ exception/          Excepciones + GlobalExceptionHandler
│     │  ├─ iot/                MQTT, validación, outbox, InfluxDB
│     │  ├─ mail/               Selección Logging/SMTP + diagnósticos
│     │  ├─ repository/         13 repositorios + 6 proyecciones
│     │  ├─ security/           JWT, filtros, principal, reset token
│     │  └─ service/            8 servicios de negocio
│     ├─ main/resources/
│     │  ├─ application.properties
│     │  └─ db/migration/       V1 … V10
│     └─ test/java/…            32 clases de prueba
├─ frontend/                    React + Vite
│  ├─ index.html
│  ├─ vite.config.js            Proxy /api → localhost:8080
│  ├─ package.json
│  ├─ .env.local                VITE_MOCK_AUTH=false (no versionado)
│  ├─ public/                   favicon, icons, imágenes, GLB optimizado
│  ├─ MuseoSmart2.glb           64 MB (duplicado del de public/)
│  └─ src/
│     ├─ main.jsx, App.jsx, App.css, index.css, Login.css
│     ├─ components/            21 .jsx + 11 .css
│     ├─ data/                  21 módulos (API, mocks y datos estáticos)
│     └─ assets/
├─ docker/                      Infraestructura IoT
│  ├─ docker-compose.yml        mosquitto, nodered, redis, influxdb
│  ├─ .env / .env.example
│  ├─ mosquitto/{config,entrypoint}
│  └─ nodered/{museo-smart-flows.json,entrypoint}
├─ public/images/               Copia suelta NO referenciada (ignorada por git)
├─ docs/                        Esta documentación (nueva)
└─ .gitignore
```

### 2.3 Puntos de entrada

| Aplicación | Entrada | Arranque |
|---|---|---|
| Backend | `com.museosmart.MuseoSmartApplication` (`@SpringBootApplication`, `@EnableScheduling`) | `./mvnw spring-boot:run`, `java -jar target/museo-smart-backend-0.0.1-SNAPSHOT.jar` o `iniciar-museo.ps1` |
| Frontend | `frontend/index.html` → `src/main.jsx` → `App.jsx` | `npm run dev` (Vite) / `npm run build` → `dist/` |
| IoT | `docker/docker-compose.yml` | `docker compose up -d` desde `docker/` |
| Migraciones | Flyway al arrancar el backend | `spring.flyway.locations=classpath:db/migration` |

### 2.4 Dependencias entre módulos

- `service` depende de `repository`, `entity`, `dto` y `security`.
- `iot` depende de `repository`, `service` (Alerta, Popularidad) y `iot/influx`.
- `mail` es consumido por `PasswordResetService` a través de la interfaz
  `MailService`.
- `controller` solo orquesta servicios y mapea DTOs.
- `SecurityConfig` registra dos filtros propios: `JwtAuthenticationFilter` y
  `PrimerInicioSesionFilter`.

---

## 3. Backend

### 3.1 Configuración de Spring Boot

`backend/src/main/resources/application.properties` (117 líneas) define:

| Propiedad | Valor / variable | Observación |
|---|---|---|
| `server.port` | `${SERVER_PORT:8080}` | |
| `spring.datasource.url` | `${DB_URL:jdbc:postgresql://localhost:5432/Museo_Smart}` | nombre con mayúsculas y guion bajo |
| `spring.datasource.username/password` | `${DB_USERNAME:postgres}` / `${DB_PASSWORD:postgres}` | credenciales de desarrollo por defecto |
| `spring.jpa.hibernate.ddl-auto` | `validate` | el esquema lo controla Flyway |
| `spring.jpa.open-in-view` | `false` | por eso los repositorios usan `@EntityGraph` |
| `spring.flyway.*` | `enabled=true`, `baseline-on-migrate=true`, `baseline-version=0` | |
| `management.endpoints...` | expone `health,info` | `/actuator/health` público |
| `app.security.jwt.secret` | `${JWT_SECRET:}` | si falta, clave aleatoria en memoria |
| `app.security.jwt.expiracion-minutos` | `${JWT_EXPIRACION_MINUTOS:60}` | |
| `app.security.reset.expiracion-minutos` | `${RESET_EXPIRACION_MINUTOS:15}` | |
| `app.mail.habilitado` | `${APP_MAIL_HABILITADO:false}` | por defecto no envía correo |
| `app.iot.mqtt.*` | `enabled=true`, `tcp://localhost:1884`, topics y QoS 1 | |
| `app.iot.limites.*` | T −100..100, HR 0..100, lux 0..200000 | validación de payloads |
| `app.iot.influx.*` | `enabled=true`, `http://localhost:8087`, org/bucket/lote/reintentos | token vacío ⇒ drenado inactivo |
| `app.bootstrap.superadmin.*` | vacío por defecto | sin variables no se crea nadie |

No existe `application-{profile}.yml`, ni `banner`, ni configuración adicional.

### 3.2 Arranque y orden de inicialización

1. Spring Boot levanta el contexto.
2. Flyway valida/aplica `V1…V10` (en ese orden numérico).
3. Hibernate valida el esquema (`ddl-auto=validate`).
4. `SuperAdminInitializer` (`ApplicationRunner`) crea el primer SuperAdmin solo si
   hay email+password configurados, la contraseña tiene ≥8 caracteres y la tabla
   `usuario_admin` está vacía.
5. `MqttConsumidor` se conecta en `ApplicationReadyEvent` si
   `app.iot.mqtt.enabled=true`; se suscribe a los dos topics y reintenta con
   `automaticReconnect`.
6. `@EnableScheduling` activa `OutboxDrenadorInflux.drenar()` cada
   `INFLUX_INTERVALO_MS` (15 s por defecto).

Trace real del arranque observado:

```
Flyway: Successfully validated 10 migrations
HikariPool-1 - Start completed
Tomcat started on port 8080
Started MuseoSmartApplication in 11.502 seconds
Bootstrap de SuperAdmin omitido: variables no configuradas
Consumidor MQTT deshabilitado (app.iot.mqtt.enabled=false)
```

### 3.3 Controladores REST y endpoints

Todos los endpoints llevan prefijo `/api/v1`.

#### Autenticación — `AuthController`

| Método | Ruta | Cuerpo | Respuesta | Acceso |
|---|---|---|---|---|
| POST | `/auth/login` | `{correo, contrasena}` | `LoginResponse` | público |
| POST | `/auth/cambiar-contrasena` | `{contrasenaActual, nuevaContrasena}` | `204` | autenticado |

`LoginResponse` real: `{token, tipo:"Bearer", correo, rol, debeCambiarContrasena, expiraEnMinutos}`.

#### Recuperación — `PasswordResetController`

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/auth/recuperacion/solicitar` | `{correo}` | `{mensaje}` uniforme |
| POST | `/auth/recuperacion/verificar` | `{correo, codigo}` (6 dígitos) | `{tokenRestablecimiento, expiraEnMinutos}` |
| POST | `/auth/recuperacion/restablecer` | `{tokenRestablecimiento, nuevaContrasena}` | `204` |

#### Salas y exhibiciones públicas

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/salas` | `SalaResponse[]` ordenado por `orden` |
| GET | `/salas/{id}` | `SalaResponse` o `404` |
| GET | `/salas/{salaId}/exhibiciones` | `ExhibicionResponse[]` (solo activas) |
| GET | `/exhibiciones` | `ExhibicionResponse[]` (solo activas) |
| GET | `/exhibiciones/{id}` | `ExhibicionResponse` (404 si inactiva) |

#### Popularidad pública

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/popularidad/visitas` | `{exhibicionId, sesionAnonimaId?, fuente}` | `201 {registrada, exhibicionId}` |

#### Administración de exhibiciones

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/admin/exhibiciones` | — | `ExhibicionResponse[]` (incluye inactivas) |
| PATCH | `/admin/exhibiciones/{id}/estado` | `{activa, motivo?}` | `ExhibicionResponse` |

#### Alertas

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/admin/alertas?todas=false` | activas (`ABIERTA`/`RECONOCIDA`) |
| GET | `/admin/alertas?todas=true` | histórico completo |
| PATCH | `/admin/alertas/{id}/resolver` | `AlertaResponse` |

#### Popularidad administrativa

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/admin/popularidad/ranking?limite=n` | `RankingExhibicionResponse[]` con `posicion` (empates comparten puesto) |

#### Monitoreo IoT

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/admin/monitoreo/sensores` | `SensorMonitoreoResponse[]` |
| GET | `/admin/monitoreo/lecturas-recientes` | `LecturaResponse[]` |
| GET | `/admin/monitoreo/resumen` | `ResumenMonitoreoResponse` |
| GET | `/admin/monitoreo/historico?metrica=&desde=&hasta=&sensor=` | `HistoricoResponse` (máx. 7 días) |
| GET | `/admin/monitoreo/salud-outbox` | `SaludOutboxResponse` |

#### Administración de usuarios

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/admin/usuarios` | — | `UsuarioAdminResponse[]` |
| GET | `/admin/usuarios/{id}` | — | `UsuarioAdminResponse` |
| POST | `/admin/usuarios` | `{nombre, correo, rol, contrasena}` | `201 UsuarioAdminResponse` |
| PUT | `/admin/usuarios/{id}` | `{nombre, correo, rol}` (rol solo validado, no se cambia) | `UsuarioAdminResponse` |
| PATCH | `/admin/usuarios/{id}/estado` | `{estado}` ∈ ACTIVO/INACTIVO/BLOQUEADO | `UsuarioAdminResponse` |
| DELETE | `/admin/usuarios/{id}` | — | `204` |

#### Documentación y salud

`GET /v3/api-docs`, `GET /swagger-ui/**`, `GET /actuator/health`, `GET /actuator/info` — públicos.

### 3.4 Servicios y reglas de negocio

| Servicio | Responsabilidad y reglas verificadas |
|---|---|
| `AuthService` | Busca por correo (case-insensitive), exige estado `ACTIVO`, `BCrypt.matches`, actualiza `ultimoAccesoEn`, emite JWT. Cambio de contraseña: verifica la actual, exige que la nueva sea distinta, fija `primerInicioSesion=false` e incrementa `tokenVersion` (revoca JWT previos). |
| `PasswordResetService` | Código de 6 dígitos con `SecureRandom`, guardado **hasheado** (BCrypt), vigencia 15 min, máximo 5 intentos, un solo código vigente por usuario (invalida anteriores). Respuesta uniforme para no revelar existencia del correo. Si el correo falla, revierte la transacción. `restablecer` consume el código y revoca tokens. |
| `UsuarioAdminService` | Roles `SUPERADMIN`/`ADMIN`; estados `ACTIVO/INACTIVO/BLOQUEADO`; correo único case-insensitive; nuevas cuentas nacen `ACTIVO` y con `primerInicioSesion=true`; protege al último SUPERADMIN activo usando `SELECT … FOR UPDATE` ordenado por id (evita deadlocks). Cambiar estado incrementa `tokenVersion`. |
| `ExhibicionService` | Listados públicos solo de activas; alta/edición inexistente; `cambiarEstado` usa `set_config` para que el trigger registre usuario y motivo; si el estado no cambia, no escribe. |
| `SalaService` | Listado ordenado por `orden`; 404 si no existe. |
| `PopularidadService` | Valida exhibición activa, fuente en el conjunto permitido y UUID de sesión (lo genera si falta). Inserta con `ON CONFLICT DO NOTHING` sobre `uq_visita_dedup` (ventana de 1 minuto). Ranking con empates que comparten posición. |
| `AlertaService` | Evalúa T/HR/LUZ contra los límites de las exhibiciones activas de la sala del sensor, tomando la banda **más permisiva**. Abre alerta `AMBIENTAL`/`ADVERTENCIA` o resuelve la activa si vuelve a rango. Deduplicada por índice único parcial. |
| `MonitoreoService` | Última lectura por (sensor, métrica) con `DISTINCT ON`; promedios de 24 h; presencia real; histórico Flux con máximo 7 días y validación de nombre de sensor por regex. |
| `MensajeIotService` | Registra el crudo de forma idempotente (`REQUIRES_NEW`), procesa ambiental/presencia en otra transacción y marca `PROCESADO` o `ERROR`. En presencia detecta flanco de subida y registra una visita por episodio. |
| `MedicionEnvioService` | Envía **una** medición del outbox a InfluxDB en su propia transacción; en fallo incrementa intentos y programa reintento o marca `ERROR` a los 10. |

### 3.5 Entidades y modelo de datos

| Entidad | Tabla | Campos relevantes |
|---|---|---|
| `Sala` | `sala` | nombre, descripción, estado, orden, auditoría |
| `Exhibicion` | `exhibicion` | sala, código único, título, textos, material, límites ambientales, `activa` |
| `ExhibicionEstadoHistorial` | `exhibicion_estado_historial` | estado anterior/nuevo, motivo, `cambiadoPor` |
| `UsuarioAdmin` | `usuario_admin` | nombre, correo, `hashContrasena`, rol, estado, `primerInicioSesion`, `tokenVersion`, `ultimoAccesoEn` |
| `ContrasenaReset` | `contrasena_reset` | usuario, `codigoHash`, expiración, usado/invalidado, intentos |
| `Visita` | `visita` | exhibición, `sesionAnonimaId`, fuente, `valida`, `ventanaInicio` |
| `Sensor` | `sensor` | código, tipo (`PRESENCIA`/`MULTI`), categoría, sala **o** exhibición, estado, `presenciaActual` |
| `Alerta` | `alerta` | sensor, tipo, severidad, estado, `condicionClave`, fechas |
| `MensajeIot` | `mensaje_iot` | `mensajeId` UUID único, topic, payload `jsonb`, estado, error |
| `MedicionPendiente` | `medicion_pendiente` | mensaje, sensor, métrica, valor, unidad, `medidoEn`, estado, intentos, `proximoIntentoEn`, `ultimoError` |

`contenido_multimedia` existe en el esquema (V3) pero **no tiene entidad** ni
endpoint: no se usa.

### 3.6 Repositorios y consultas destacadas

- `MonitoreoRepository`: cuatro consultas nativas PostgreSQL
  (`DISTINCT ON`, `AVG`, `COUNT(*) FILTER`) y una JPQL con `LEFT JOIN FETCH`.
- `VisitaRepository`: `INSERT … ON CONFLICT DO NOTHING` y las dos consultas del
  ranking sobre `v_ranking_exhibicion`.
- `MensajeIotRepository`: `INSERT … ON CONFLICT (mensaje_id) DO NOTHING`.
- `UsuarioAdminRepository.findByRolForUpdate`: `@Lock(PESSIMISTIC_WRITE)`.
- `SensorRepository.findByCodigoConBloqueo`: bloqueo pesimista para presencia.
- `ExhibicionRepository`/`AlertaRepository`: `@EntityGraph` para evitar
  `LazyInitializationException` con `open-in-view=false`.

### 3.7 DTOs, validaciones y manejo de errores

- DTOs como `record` con anotaciones `jakarta.validation` (`@NotBlank`, `@Email`,
  `@Size`, `@Pattern`, `@Positive`, `@NotNull`).
- Grupos de validación `UsuarioAdminRequest.OnCreate` (exige contraseña) y
  `OnUpdate` (no la exige).
- `DtoMapper` centraliza el mapeo entidad → DTO.
- `GlobalExceptionHandler` devuelve siempre `ApiErrorResponse`
  `{timestamp, status, error, mensaje, ruta, erroresValidacion}` con esta
  correspondencia:

| Excepción | HTTP |
|---|---|
| `RecursoNoEncontradoException` | 404 |
| `ReglaNegocioException` | 400 |
| `CredencialesInvalidasException` | 401 |
| `ConflictoException` | 409 |
| `DataIntegrityViolationException` | 409 |
| `MethodArgumentNotValidException` | 400 + mapa por campo |
| `MethodArgumentTypeMismatchException` | 400 |
| `HttpRequestMethodNotSupportedException` | 405 |
| `NoResourceFoundException` | 404 |
| `Exception` | 500 genérico (se registra el stack) |

`RestSecurityHandlers` produce JSON equivalente para 401/403 del filtro de
seguridad.

### 3.8 Seguridad

- **Autenticación**: JWT firmado HMAC-SHA256 (`jjwt` 0.12.6), claims
  `sub=correo`, `uid`, `rol`, `nombre`, `pio` (primer inicio), `tv`
  (token version).
- **Autorización**: `SecurityConfig` define rutas públicas y por rol:
  - `/api/v1/admin/usuarios/**` → `ROLE_SUPERADMIN`
  - `/api/v1/admin/exhibiciones|alertas|popularidad|monitoreo/**` →
    `ROLE_ADMIN` o `ROLE_SUPERADMIN`
  - cualquier otra ruta → autenticado
- **Filtros**:
  1. `JwtAuthenticationFilter`: valida firma/expiración y **revalida contra la
     BD** (usuario existe, `ACTIVO`, `token_version` coincide). Un token viejo
     deja la petición anónima.
  2. `PrimerInicioSesionFilter`: devuelve 403 si el usuario debe cambiar la
     contraseña e intenta usar `/admin/exhibiciones`, `/admin/usuarios`,
     `/admin/popularidad` o `/admin/monitoreo`. **No cubre `/admin/alertas`**
     (hecho verificado en la lista `RUTAS_PROTEGIDAS`).
- **Hashing**: `BCryptPasswordEncoder` para contraseñas y para los códigos de
  recuperación.
- **Sesión**: `SessionCreationPolicy.STATELESS`; CSRF deshabilitado.
- **CORS**: **no configurado** en ninguna clase.
- **Secretos**: solo por variables de entorno; `.env` no versionados.
- **Riesgos de desarrollo**: Swagger y `/actuator/health` públicos; sin rate
  limiting ni bloqueo de cuenta por intentos; JWT en `sessionStorage` (XSS);
  contraseñas por defecto `postgres/postgres` en properties; sin TLS.

### 3.9 Correo electrónico

- Interfaz `MailService` con dos implementaciones condicionales:
  - `LoggingMailService` (cuando `app.mail.habilitado=false` o falta):
    **no envía**, solo registra un mensaje sin el código.
  - `SmtpMailService` (`true`): SMTP con `SimpleMailMessage`, STARTTLS
    obligatorio, remitente `app.mail.from`.
- `MailSenderConfig` crea el `JavaMailSender` y elimina espacios de la contraseña
  de aplicación de Gmail.
- `MailConfigDiagnostics` avisa al arrancar si faltan host/usuario/contraseña
  (nunca imprime valores).
- **Consecuencia práctica**: con la configuración por defecto, el flujo de
  recuperación **no entrega ningún código al usuario**; solo queda el hash en
  `contrasena_reset`. Para probarlo hay que habilitar SMTP o generar el código
  con conocimiento del valor (no hay endpoint que lo exponga).

### 3.10 Recorrido de una petición (ejemplos reales)

**A. Login**

1. `Login.jsx` valida correo/contraseña y llama `iniciarSesion`.
2. `authApi.js` → `httpClient.solicitarJson('/auth/login', {POST, sin token})`.
3. `AuthController.login` valida el DTO y delega en `AuthService.login`.
4. Repositorio `findByCorreoIgnoreCase` + `BCrypt.matches`; se actualiza
   `ultimoAccesoEn`.
5. `JwtService.generarToken` firma el JWT.
6. `LoginResponse` viaja al cliente; `sessionService.guardarSesion` la persiste
   en `sessionStorage` y `App.jsx` navega a `#/admin`.

**B. Cambiar estado de una exhibición**

1. `GestionExhibiciones.jsx` abre modal de confirmación.
2. `exhibicionesApi.cambiarEstadoExhibicion(id, activa)` → `solicitarAdmin`
   (añade `Authorization: Bearer`).
3. `JwtAuthenticationFilter` reconstruye el principal desde la BD;
   `PrimerInicioSesionFilter` bloquea si procede; `SecurityConfig` exige rol.
4. `ExhibicionService.cambiarEstado` fija variables de sesión
   `museo_smart.usuario_admin_id` y `museo_smart.motivo_estado`.
5. `UPDATE exhibicion` dispara `trg_exhibicion_historial`, que inserta la fila de
   auditoría; `trg_exhibicion_actualizado_en` actualiza la marca de tiempo.
6. Se devuelve `ExhibicionResponse`; la UI recarga el listado y muestra un toast.

**C. Lectura ambiental MQTT**

1. Node-RED publica en `museo/sensores/ambiental` cada 5 s.
2. `MqttConsumidor` recibe y llama a `MqttMensajeProcesador.procesar`.
3. Extrae `mensajeId`; `MensajeIotService.registrarRecepcion` inserta el crudo
   (`ON CONFLICT DO NOTHING`).
4. `procesarContenido` valida rangos, comprueba que el sensor existe, es
   `AMBIENTAL` y pertenece a la sala indicada.
5. Inserta 3 filas en `medicion_pendiente` (`TEMPERATURA`, `HUMEDAD`, `LUZ`) y
   evalúa alertas.
6. El planificador `OutboxDrenadorInflux` envía cada fila a InfluxDB y actualiza
   su estado.

---

## 4. Frontend

### 4.1 Estructura y archivos principales

| Archivo | Rol |
|---|---|
| `src/main.jsx` | `createRoot` + `StrictMode` |
| `src/App.jsx` | Enrutado por hash y composición de la página pública |
| `src/Login.css`, `App.css`, `index.css` | Estilos globales |
| `src/components/*` | 21 componentes y 11 hojas de estilo |
| `src/data/*` | Clientes API, sesión, datos estáticos, mocks y configuración 3D |

No usa React Router, Redux, Zustand, TanStack Query ni Axios. La navegación es
manual con `window.location.hash` y el estado es local con `useState`/`useMemo`.

### 4.2 Páginas, componentes y rutas

| Hash | Vista |
|---|---|
| `#` (vacío) | Portada: `Navbar`, `Hero`, `Salas`, `AcercaDe`, `Footer`, `ModalSala` |
| `#/login` | `Login` |
| `#/recuperar` | `Recuperacion` (4 pasos) |
| `#/recorrido-virtual` | `PaginaRecorrido` → `RecorridoMuseo` (carga diferida) |
| `#/admin` y subrutas | `PanelAdmin` (requiere sesión en cliente) |
| `#/admin/exhibiciones`, `/monitoreo`, `/alertas`, `/popularidad`, `/administradores`, `/perfil` | Subvistas del panel |

Componentes del panel: `InicioDashboard`, `GestionExhibiciones`, `MonitoreoIoT`,
`Alertas`, `Popularidad`, `Administradores`, `MiPerfil`.

Componentes públicos: `Navbar`, `Hero`, `Salas`, `TarjetaSala`, `ModalSala`,
`AcercaDe`, `Footer`, `Login`, `Recuperacion`, `PaginaRecorrido`,
`RecorridoMuseo`, `iconos`.

`ModalIngreso.jsx` existe pero **no se importa** (código muerto).

### 4.3 Gestión de estado y sesión

- Estado local por componente; los datos se cargan en `useEffect` con
  `AbortController` y `Promise.allSettled` cuando hay varias peticiones.
- Sesión en `sessionStorage` (`museo_smart.sesion`): token, tipo, correo, nombre,
  rol, `debeCambiarContrasena`, `expiraEnMinutos`.
- El nombre se obtiene decodificando el payload del JWT **sin verificar firma**
  (solo presentación).
- Sesión anónima del visitante: UUID en `sessionStorage`
  (`museo_smart.sesion_anonima`).
- `httpClient` borra la sesión al recibir 401 en una petición autenticada.
- La protección de `#/admin` es solo visual: la autorización real está en el
  backend.

### 4.4 Capa de acceso a la API

| Módulo | Endpoints que consume |
|---|---|
| `authApi.js` | login, recuperación (3), cambio de contraseña |
| `adminApi.js` | helper que fuerza `autenticado: true` |
| `exhibicionesApi.js` | listar y cambiar estado (admin) |
| `exhibicionesPublicasApi.js` | exhibiciones por sala y catálogo público |
| `alertasApi.js` | listar y resolver |
| `popularidadApi.js` | ranking |
| `popularidadPublicaApi.js` | registrar visita (con deduplicación local de 60 s) |
| `monitoreoApi.js` | sensores, lecturas, resumen, histórico, salud del outbox |
| `usuariosApi.js` | CRUD de administradores |
| `sesionAnonima.js` | generación/lectura del UUID |
| `sessionService.js` | persistencia de sesión |

`httpClient.js`:
- Base `VITE_API_BASE_URL` o `/api/v1`.
- `Content-Type` solo si hay cuerpo.
- `Authorization: Bearer` solo si `autenticado: true`.
- Error tipado `ErrorHttp` con `estado`, `tipo`
  (`conexion|cliente|servidor|autorizacion`) y `erroresValidacion`.
- 204 tratado como cuerpo vacío.

### 4.5 Errores, carga y validaciones

- Cada vista maneja `cargando`, `errorCarga` y botón de reintento; los errores se
  traducen a mensajes en español según `ErrorHttp.tipo`.
- Validaciones de formulario en cliente: correo con regex, campos obligatorios,
  longitud mínima de 8 para contraseña, confirmación de contraseña, 6 dígitos
  para el código.
- Mayúscula/número se muestran como **recomendaciones**, coherente con el
  backend que solo exige longitud.
- El checkbox “Recordarme” del login **no tiene efecto** (no se usa su valor).

### 4.6 Variables de entorno del frontend

| Variable | Uso | Valor actual local |
|---|---|---|
| `VITE_MOCK_AUTH` | activa `authApiMock` | `false` |
| `VITE_API_BASE_URL` | base de la API | no definida ⇒ `/api/v1` |
| `VITE_BACKEND_URL` | destino del proxy de Vite (solo dev) | no definida ⇒ `http://localhost:8080` |
| `BASE_URL` (Vite) | prefijo de recursos estáticos | `/` |

`.env.local` está ignorado por git (`*.local`).

### 4.7 Recursos estáticos

- `public/images/`: 8 imágenes de salas/hero.
- `public/images/exhibiciones/`: 16 archivos (JPG y PNG duplicados) para las 8
  fichas.
- `public/MuseoSmart2.optimizado.glb` (11 MB): modelo 3D usado realmente.
- `public/MuseoSmart2.glb` y `frontend/MuseoSmart2.glb` (64 MB cada uno): modelo
  original duplicado.
- El backend **no sirve** el frontend ni los recursos: no hay `static/` ni
  `index.html` en `src/main/resources`.

### 4.8 Gráficos, tablas y paneles

- `MonitoreoIoT.jsx` dibuja series con `<polyline>` SVG a partir de
  `HistoricoResponse.series[].puntos[]` (campos `tiempo`/`valor`), tabla
  paginada de lecturas, tarjetas de promedios y presencia.
- `Popularidad.jsx` calcula distribución por sala y porcentajes a partir del
  ranking real.
- `InicioDashboard.jsx` deriva contadores de exhibiciones, alertas, ranking y
  (solo SUPERADMIN) usuarios.
- `Alertas.jsx` mapea enums del backend a etiquetas en español.
- `Administradores.jsx` tiene filtros, drawer, modales de crear/editar/eliminar y
  protección local del último SuperAdmin.

### 4.9 Qué es real y qué no en la interfaz

| Elemento visual | Origen |
|---|---|
| Salas de la portada | Constante local `data/salas.js` (**no** viene de `/salas`) |
| Exhibiciones de una sala | API real `/salas/{id}/exhibiciones` |
| Ficha de exhibición | Datos de la API; imagen local asignada por id |
| Recorrido 3D | GLB local + catálogo real solo para títulos si el mapeo existiera |
| Panel: exhibiciones/alertas/ranking/usuarios/monitoreo | API real |
| Notificaciones del topbar (badge “3”) | **Ficticio**, fijo en el JSX |
| Métricas de `panelSuperAdmin.js` | Simuladas y no renderizadas |
| “Recordarme”, avatar editable, notificaciones del perfil | Solo visuales |

---

## 5. Base de datos y persistencia

### 5.1 PostgreSQL (fuente de verdad)

Base `Museo_Smart`, esquema `public`, codificación UTF8. Tablas y vista descritas
en 3.5. Puntos clave:

- **4 salas máximo** por trigger con `pg_advisory_xact_lock`.
- **2 exhibiciones por sala** por trigger con advisory locks.
- `uq_exhibicion_codigo`, `uq_usuario_admin_correo_lower`,
  `uq_reset_vigente_por_usuario` (parcial), `uq_visita_dedup`,
  `uq_mensaje_iot_mensaje_id`, `uq_medicion_mensaje_metrica`,
  `uq_alerta_condicion_activa` (parcial), `uq_multimedia_principal_por_exhibicion`.
- Triggers de auditoría `set_actualizado_en()` en casi todas las tablas;
  `trg_visita_ventana`, `trg_exhibicion_historial`, `trg_sala_limite`,
  `trg_exhibicion_limite_sala`.
- Checks de rangos ambientales y de coherencia del sensor
  (`ck_sensor_ubicacion`, `ck_sensor_categoria_tipo`).
- Vista `v_ranking_exhibicion` (ranking al vuelo sobre visitas válidas).

Datos iniciales: 4 salas, 8 exhibiciones `[PROVISIONAL]`, 12 sensores; los
límites ambientales de V9. **No hay usuario inicial en migraciones.**

### 5.2 Redis

Definido en `docker-compose.yml` con AOF y contraseña, pero **ningún componente
del código lo usa**. `PopularidadService` documenta explícitamente que no depende
de Redis.

### 5.3 InfluxDB 2.x

- Bucket `museo_smart_ambiental`, org `museo_smart`, retención 90 días.
- Esquema de escritura (`InfluxEscritor`): `measurement = TEMPERATURA|HUMEDAD|LUZ|PRESENCIA`,
  tags `sensor`, `metrica`, `unidad`, field `valor`, precisión ms.
- Solo se envía lo que llega a `medicion_pendiente`. Si InfluxDB no está
  configurado (`INFLUX_TOKEN` vacío), el drenado no se ejecuta y **los datos
  permanecen en PostgreSQL** (no se pierden).

### 5.4 Búfer persistente (outbox)

`medicion_pendiente` es el outbox:

- Estados `PENDIENTE → ENVIADO` o, tras 10 intentos, `ERROR`.
- `proximo_intento_en` implementa el backoff fijo de 30 s.
- Cada envío se confirma en su propia transacción.
- **No existe purga**: la tabla creció a 74 703 filas en la base local, de las
  cuales 74 683 están `ENVIADO` y 20 en `ERROR`. Es un crecimiento indefinido.
- Las lecturas del panel salen de esta tabla (`DISTINCT ON`), no de InfluxDB.

### 5.5 Respaldo y restauración (propuesta operativa)

```powershell
# Respaldo
docker exec -t museosmart-postgres pg_dump -U postgres -d Museo_Smart -Fc > museo_smart.dump

# Restauración (base vacía)
docker exec -i museosmart-postgres pg_restore -U postgres -d Museo_Smart --clean --if-exists < museo_smart.dump
```

InfluxDB: respaldar el volumen `museosmart_influxdb_data` (o usar
`influx backup`). Redis no requiere respaldo porque no se usa.

---

## 6. Arquitectura IoT y tiempo real

### 6.1 Flujo real

```
Node-RED (inject cada 5 s)
   └─ function "Simulador 12 sensores"
        ├─ 4 mensajes → topic museo/sensores/ambiental
        │    {mensajeId, sensorCodigo, salaId, temperatura, humedad, luminosidad, timestamp}
        └─ 8 mensajes → topic museo/sensores/presencia
             {mensajeId, sensorCodigo, exhibicionId, presencia, timestamp}
   └─ mqtt out (broker "mosquitto", puerto 1883, QoS 0)
Mosquitto (auth obligatoria, password_file generado en runtime)
   └─ Spring Boot (Paho, QoS 1, clientId único con sufijo aleatorio)
        ├─ mensaje_iot (crudo, idempotente)
        ├─ medicion_pendiente (3 filas por ambiental, 1 por presencia)
        ├─ alerta (evaluación de límites)
        ├─ visita (solo flanco de subida de presencia y exhibición activa)
        └─ OutboxDrenadorInflux → InfluxDB
Frontend ← GET /admin/monitoreo/* (polling manual; sin push)
```

### 6.2 Topics MQTT

| Topic | Dirección | Publica | Consume |
|---|---|---|---|
| `museo/sensores/ambiental` | Node-RED → backend | Node-RED | `MqttConsumidor` |
| `museo/sensores/presencia` | Node-RED → backend | Node-RED | `MqttConsumidor` |
| `museo/healthcheck` | Compose → broker | healthcheck | broker |

El `mqtt out` del flujo tiene `topic` vacío y usa el `msg.topic` fijado en la
función. Hay topics legacy en flujos deshabilitados
(`museo/exhibiciones/…/sensor`) que **no** se publican.

### 6.3 Validación y recuperación

- Validación estricta: UUID obligatorio, sensor no vacío, `salaId`/`exhibicionId`
  positivos, timestamp presente, valores finitos y en rango.
- Mensaje inválido ⇒ fila en `mensaje_iot` con estado `ERROR` y motivo; nunca se
  sustituye por valores por defecto.
- Duplicado por `mensajeId` ⇒ ignorado (idempotencia).
- Reconexión MQTT automática con re-suscripción en `connectComplete`.
- Node-RED usa `context` para conservar estado entre ciclos.

### 6.4 Límites y alertas

- Límites de payload: T −100..100, HR 0..100, lux 0..200 000.
- Límites de conservación (V9): por sala, p. ej. pintura 18–22 °C, 45–55 % HR,
  ≤150 lux.
- El simulador genera 18–30 °C, 30–70 % HR y 100–500 lux, por lo que **produce
  alertas reales** de forma habitual.
- Severidad fija `ADVERTENCIA`; no se usa `CRITICA` en el código.

### 6.5 Qué está implementado y qué no

| Elemento | Estado |
|---|---|
| Ingesta MQTT, idempotencia, outbox | Implementado |
| Escritura a InfluxDB y consulta histórica | Implementado |
| Simulador Node-RED de 12 sensores | Implementado |
| Actualización en vivo en React | **No implementado** (solo carga al montar/reintentar) |
| WebSockets/SSE | **No existen** |
| Uso de Redis | **No existe** |
| Correspondencia nodo 3D ↔ exhibición | **Pendiente** (`EXHIBICION_POR_NODO` todo `null`) |
| Publicación de credenciales MQTT al flujo | **Pendiente de confirmar** (ver doc. 04) |

---

## 7. Seguridad (resumen operativo)

1. Cambiar `DB_PASSWORD`, `JWT_SECRET`, `MQTT_PASSWORD`, `INFLUX_PASSWORD` e
   `INFLUX_TOKEN` antes de cualquier despliegue.
2. No usar las credenciales de ejemplo de `docker/.env.example`.
3. Servir frontend y API bajo el mismo origen (evita necesitar CORS).
4. Restringir `/swagger-ui` y `/actuator` en producción.
5. Habilitar HTTPS en el proxy inverso.
6. Considerar rate limiting en `/auth/login` y `/auth/recuperacion/*` (no existe).
7. No confiar en la ocultación de rutas del panel: el backend ya autoriza.

---

## 8. Integraciones externas

| Integración | Estado | Configuración |
|---|---|---|
| SMTP (Gmail) | Implementada, desactivada por defecto | `APP_MAIL_HABILITADO=true`, `MAIL_*` |
| MQTT/Mosquitto | Implementada | `MQTT_*` |
| InfluxDB 2.x | Implementada (escritura y lectura) | `INFLUX_*` |
| Node-RED | Simulador | `docker/nodered` |
| ImageKit / multimedia | **Solo tabla**, sin integración | — |
| Redis | **Sin integración** | — |
