# Documento 4. DiagnÃ³stico de preparaciÃ³n para entrega

> Fecha de la auditorÃ­a: 28/10/2026. Rama `main`, commit `05f05e7`.
> Todo lo marcado como **verificado** se comprobÃ³ leyendo el archivo o
> ejecutando el proyecto en este equipo.

---

## 1. Estado actual: quÃ© funciona

| # | Capacidad | Evidencia | Estado |
|---|---|---|---|
| 1 | Compila el backend (Java 21, Maven) | Tests y JAR existentes; arranque desde JAR | Funciona |
| 2 | Arranca el backend contra PostgreSQL 16 con las 10 migraciones | Log de Flyway `validated 10 migrations`; `/actuator/health` = UP | Funciona |
| 3 | API pÃºblica de salas y exhibiciones | `200` con datos reales | Funciona |
| 4 | ProtecciÃ³n de rutas administrativas | `401` sin token | Funciona |
| 5 | AutenticaciÃ³n JWT con revocaciÃ³n por `token_version` | CÃ³digo + `JwtServiceTest`, `JwtRevocationFilterTest` | Funciona (no se probÃ³ login real por falta de credenciales) |
| 6 | RecuperaciÃ³n de contraseÃ±a | CÃ³digo + `PasswordResetServiceTest` | Funciona en lÃ³gica; envÃ­o real depende de SMTP |
| 7 | Ranking de popularidad y deduplicaciÃ³n | CÃ³digo + vista SQL + `PopularidadServiceIntegrationTest` | Funciona |
| 8 | Ingesta MQTT idempotente | CÃ³digo + flujo Node-RED + 44 821 mensajes procesados en la base local | Funciona |
| 9 | Outbox y envÃ­o a InfluxDB | 74 683 mediciones `ENVIADO` y 20 `ERROR` en la base local | Funciona (hubo fallos puntuales) |
| 10 | Alertas ambientales | 370 alertas `AMBIENTAL/ADVERTENCIA` (5 abiertas) | Funciona |
| 11 | Presencia â†’ visitas por flanco | 4 sensores con `presencia_actual=true`; 149 visitas vÃ¡lidas | Funciona |
| 12 | Frontend build de producciÃ³n | `npm run build` correcto | Funciona |
| 13 | Lint | 0 errores, 10 advertencias | Funciona |
| 14 | Panel administrativo con datos reales | Componentes consumen la API | Funciona |
| 15 | Recorrido 3D | Modelo presente y cargable (segÃºn el autor); no se probÃ³ WebGL aquÃ­ | Funciona visualmente |
| 16 | Docker Compose de servicios IoT | `docker compose config` vÃ¡lido | ConfiguraciÃ³n vÃ¡lida (no se levantÃ³) |

---

## 2. QuÃ© necesita correcciones (defectos comprobados)

### 2.1 Fallo de prueba unitaria `MailServiceSelectionTest`

**SÃ­ntoma (verificado ejecutando Maven):**

```
Tests run: 3, Failures: 1
sinPropiedad_usaLoggingPorDefecto
No qualifying bean of type 'org.springframework.mail.javamail.JavaMailSender'
```

**Causa (verificada por experimento):** la prueba es dependiente del entorno. En
este equipo existe una variable de usuario `APP_MAIL_HABILITADO=true` (y
`MAIL_HOST`), que Spring mapea por *relaxed binding* a `app.mail.habilitado`.
Por eso el caso `sinPropiedad_usaLoggingPorDefecto` deja de ser â€œsin propiedadâ€:
se activa `SmtpMailService`, pero el `ApplicationContextRunner` del test solo
registra `MailSenderAutoConfiguration`, que no crea `JavaMailSender` porque no
hay `spring.mail.host` en las propiedades del contexto (la variable del entorno
se llama `MAIL_HOST`, no `spring.mail.host`). Resultado: falla la inyecciÃ³n del
constructor de `SmtpMailService`.

**ComprobaciÃ³n:** al ejecutar la misma prueba limpiando
`APP_MAIL_HABILITADO`/`MAIL_*` del proceso (`$env:APP_MAIL_HABILITADO=$null`, â€¦),
la prueba pasa (`exit=0`).

**Archivos:** `backend/src/test/java/com/museosmart/mail/MailServiceSelectionTest.java`,
`backend/src/main/java/com/museosmart/mail/SmtpMailService.java`,
`backend/src/main/java/com/museosmart/mail/MailSenderConfig.java`.

**SoluciÃ³n propuesta (no aplicada):** hacer la prueba hermÃ©tica con
`runner.withPropertyValues("app.mail.habilitado=false")` tambiÃ©n en el caso
â€œsin propiedadâ€, o ejecutar los tests en un JVM con variables de entorno
controladas (perfil Maven/CI). Alternativa: registrar un `JavaMailSender` de
prueba mediante `@TestConfiguration`. Requiere decisiÃ³n del autor.

**Impacto:** `mvn test` falla por esta clase; el resto de las pruebas revisadas
pasa. El arranque de la aplicaciÃ³n no se ve afectado porque `SmtpMailService`
exige `app.mail.habilitado=true`.

### 2.2 El JAR versionado en `target/` estÃ¡ desactualizado

**Verificado:** el JAR `backend/target/museo-smart-backend-0.0.1-SNAPSHOT.jar`
(fechado 15/10/2026) contiene `V1â€¦V9` pero **no** `V10__presencia_actual_sensor.sql`
(se listÃ³ su contenido con `jar tf`). La base local ya estÃ¡ en versiÃ³n 10 y el log
muestra:

```
Schema "public" has a version (10) that is newer than the latest available migration (9)
```

**Impacto:** usar ese JAR contra una base nueva crea el esquema sin
`presencia_actual`; la entidad `Sensor` declara la columna y
`ddl-auto=validate` puede fallar o el flanco de presencia no funcionarÃ¡.

**SoluciÃ³n:** `mvn -DskipTests package` antes de distribuir. No versionar
`target/` (ya estÃ¡ ignorado).

### 2.3 `PrimerInicioSesionFilter` no cubre `/admin/alertas`

**Verificado** en `backend/src/main/java/com/museosmart/security/PrimerInicioSesionFilter.java`:
la lista `RUTAS_PROTEGIDAS` contiene exhibiciones, usuarios, popularidad y
monitoreo, pero **no** `/api/v1/admin/alertas`.

**Impacto:** un usuario con `primerInicioSesion=true` puede listar y resolver
alertas antes de cambiar la contraseÃ±a. Es una inconsistencia con el resto del
panel.

**SoluciÃ³n:** aÃ±adir `"/api/v1/admin/alertas"` a la lista (cambio de una lÃ­nea) y
ajustar/prueba. No se aplicÃ³ por la regla de no modificar el proyecto durante el
diagnÃ³stico.

### 2.4 Node-RED no tiene credenciales MQTT en el flujo exportado

**Verificado:** el objeto `mqtt-broker` de
`docker/nodered/museo-smart-flows.json` no tiene propiedades de usuario/contraseÃ±a
(Node-RED las guarda cifradas en `flows_cred.json`, que no se versiona). El broker
tiene `allow_anonymous false` y genera `passwd` desde `MQTT_USERNAME/PASSWORD`.

**Impacto:** al desplegar en otro equipo, el nodo broker aparecerÃ¡ sin
credenciales y la publicaciÃ³n fallarÃ¡ con error de autenticaciÃ³n hasta que se
configuren por la UI.

**SoluciÃ³n:** configurar las credenciales en la UI de Node-RED (nodo
â€œMosquitto Dockerâ€), o documentar el paso como obligatorio (ya incluido en el
manual de instalaciÃ³n). No se debe versionar `flows_cred.json` con secretos.

### 2.5 Crecimiento sin lÃ­mite del outbox

**Verificado** en la base local: `medicion_pendiente` = 74 703 filas (19 MB), de
las cuales 74 683 estÃ¡n `ENVIADO`. No existe job de purga en el cÃ³digo.

**Impacto:** la tabla y sus Ã­ndices crecen indefinidamente; las consultas del
panel (`DISTINCT ON` sobre toda la tabla) se degradarÃ¡n.

**SoluciÃ³n propuesta:** job programado que elimine `ENVIADO` con antigÃ¼edad mayor
a X dÃ­as, o particionado por `medido_en`. No implementado.

### 2.6 Frontend: `dist/` no puede consumir la API sin proxy

**Verificado:** no existe configuraciÃ³n CORS en el backend
(`Select-String` sobre todo `src/main` no devuelve coincidencias). El `httpClient`
usa `/api/v1` por defecto.

**Impacto:** si se publica `dist/` en otro puerto/origen, todas las llamadas
fallan por CORS.

**SoluciÃ³n:** servir frontend y API bajo el mismo origen con Nginx (incluido en la
propuesta Docker).

### 2.7 CÃ³digo muerto y datos simulados residuales

| Elemento | Riesgo |
|---|---|
| `frontend/src/components/ModalIngreso.jsx` | No se usa; duplica un login antiguo |
| `monitoreoData.js`, `alertasData.js`, `popularidadData.js`, `administradoresData.js` | Datos ficticios no importados; confunden a quien lee |
| Arrays de `panelSuperAdmin.js` (`resumenInicio`, etc.) | Simulados y no renderizados |
| `exhibicionesIniciales` de `exhibicionesData.js` | Simulados y no renderizados |
| Badge de notificaciones fijo â€œ3â€ y â€œRecordarmeâ€ sin efecto | UI engaÃ±osa para el usuario final |
| Avatar â€œCambiar fotoâ€ sin acciÃ³n | BotÃ³n sin funcionalidad |

**SoluciÃ³n:** eliminar o marcar claramente como legado. No se modificÃ³ nada.

### 2.8 DuplicaciÃ³n de 64 MB del modelo 3D

**Verificado:** `frontend/MuseoSmart2.glb` y `frontend/public/MuseoSmart2.glb`
tienen exactamente 64 457 228 bytes. Solo se usa
`/MuseoSmart2.optimizado.glb` (`museo3d.js`).

**Impacto:** repositorio innecesariamente pesado (~128 MB) y clonaciÃ³n lenta.

**SoluciÃ³n:** conservar solo el optimizado en `public/` y sacar el original del
control de versiones (o usar Git LFS).

### 2.9 `iniciar-museo.ps1` contiene una ruta personal

**Verificado:** `$jdkDefault = 'C:\Users\Gaby\AppData\Local\Programs\jdk-21.0.12.1+1'`.

**Impacto:** en otro equipo sin `JAVA_HOME` vÃ¡lido, el script aborta con un
mensaje que menciona una ruta ajena.

**SoluciÃ³n:** leer `JAVA_HOME` y, si no existe, pedir la ruta; no codificar rutas
del autor.

### 2.10 CodificaciÃ³n de texto

- Los archivos se ven con caracteres corruptos en la consola de Windows
  (`histï¿½rica`, `Museo Smart ï¿½ Explora`), pero **todos son UTF-8 vÃ¡lidos**: se
  validÃ³ byte a byte el contenido de `frontend/src`, `backend/src` y
  `frontend/index.html`, sin secuencias invÃ¡lidas ni caracteres U+FFFD. La
  respuesta HTTP de `/api/v1/salas` contiene `C3 B3` (â€œÃ³â€), y el `<title>` usa
  U+2014 (â€”).
- **ConclusiÃ³n:** es un problema de la pÃ¡gina de cÃ³digos de la consola
  (`chcp 65001` lo resuelve al leer), no del repositorio. No requiere cambios.
- Ãšnico matiz: varias vistas (`hero`, textos) fuerzan mayÃºsculas con CSS, de
  modo que algunas tildes pueden verse raras segÃºn la fuente; es estÃ©tico.

### 2.11 `iniciar-museo.ps1` fuerza `APP_MAIL_HABILITADO=true`

**Verificado:** si la variable no estÃ¡ definida, el script la pone en `true` y
exige usuario/contraseÃ±a SMTP, abortando si faltan. En un equipo nuevo sin Gmail
configurado, el arranque asistido **falla**. Debe cambiarse el valor por defecto a
`false` o pedir confirmaciÃ³n.

---

## 3. QuÃ© falta para ejecutar desde cero en otro computador

| # | Falta | Criticidad |
|---|---|---|
| 1 | Documento de instalaciÃ³n (este entregable lo cubre) | Alta |
| 2 | `Dockerfile` de backend y frontend | Alta para modalidad C |
| 3 | PostgreSQL en Compose (hoy externo) | Alta para modalidad C |
| 4 | Proxy inverso / mismo origen para el frontend | Alta |
| 5 | Script de migraciÃ³n/bootstrap reproducible sin rutas personales | Media |
| 6 | ConfiguraciÃ³n de credenciales del nodo MQTT de Node-RED | Alta |
| 7 | `.env.example` del backend completo (faltan JWT, mail, Influx, SuperAdmin) | Media |
| 8 | Purga del outbox | Media |
| 9 | Prueba de integraciÃ³n automatizada de punta a punta | Media |
| 10 | Healthcheck del backend | Baja |

---

## 4. Archivos nuevos recomendados

| Archivo | Motivo | Estado |
|---|---|---|
| `docs/01â€¦04` | DocumentaciÃ³n | **Creados** |
| `backend/Dockerfile` | Contenerizar backend | Propuesto en `docs/propuesta-docker/` |
| `frontend/Dockerfile` | Contenerizar frontend | Propuesto |
| `frontend/nginx.conf` | Proxy `/api` + SPA | Propuesto |
| `docker/compose.full.yml` | Stack completo | Propuesto |
| `docker/.env.full.example` | Variables del stack completo | Propuesto |
| `docs/propuesta-docker/README.md` | ExplicaciÃ³n de la propuesta | **Creado** |
| `backend/.env.example` ampliado | Completar variables | Recomendado (no creado para no sobrescribir) |
| Job de purga del outbox | Evitar crecimiento | Recomendado |
| `.dockerignore` (backend y frontend) | Builds livianos | Propuesto |

---

## 5. Riesgos antes de compartir el repositorio

| Riesgo | Nivel | Detalle | AcciÃ³n |
|---|---|---|---|
| Secretos locales en `docker/.env` | Alto si se comparte la carpeta comprimida | No estÃ¡ trackeado, pero existe en disco | Excluirlo al comprimir; rotar credenciales si ya se compartiÃ³ |
| `docker/mosquitto/config/passwd` | Medio | Hash real en disco (ignorado por git) | No incluirlo en el ZIP; se regenera al arrancar |
| `target/` con JAR y reportes | Bajo | Ignorado por git, pero presente en disco | Excluir del ZIP |
| `node_modules/` | Bajo | Ignorado, pero pesado | Excluir |
| Modelos GLB de 64 MB duplicados | Medio | Repositorio pesado | Git LFS o eliminar duplicado |
| ContraseÃ±as de desarrollo en `application.properties` | Medio | `postgres/postgres` por defecto | Documentar y forzar variables |
| Swagger y actuator pÃºblicos | Medio | Sin autenticaciÃ³n | Restringir en producciÃ³n |
| Sin rate limiting en login/recuperaciÃ³n | Medio | Fuerza bruta posible | AÃ±adir lÃ­mite |
| Sin CORS ni TLS | Medio | Obliga a mismo origen y HTTP | Proxy con TLS |
| `usuario_admin` real en la base del autor | Alto | La base no se versiona, pero si se exporta un dump incluirÃ­a hashes | No compartir dumps; crear usuarios nuevos |
| `contenido_multimedia` vacÃ­a y sin cÃ³digo | Bajo | No afecta | Documentado |
| Redis definido y no usado | Bajo | Consume recursos | Opcional: retirarlo del Compose o justificarlo |
| Flujo Node-RED con credenciales pendientes | Alto | El simulador no autentica en un equipo nuevo | Configure en la UI |

---

## 6. Lista de pruebas para validar una instalaciÃ³n

1. `docker compose config` sin errores.
2. `docker compose ps` con los 4 servicios `healthy` (Mosquitto, Node-RED, Redis,
   InfluxDB).
3. `docker compose logs nodered` sin errores de autenticaciÃ³n MQTT.
4. Node-RED en `http://localhost:1881` con el flujo desplegado y publicando.
5. `GET /actuator/health` = `UP`.
6. `GET /api/v1/salas` = 4.
7. `GET /api/v1/exhibiciones` = 8 activas en una base recién migrada (en la base del autor hay 7 activas y 1 inactiva).
8. `POST /api/v1/auth/login` = `200` con token.
9. `GET /api/v1/admin/exhibiciones` con token = `200`; sin token = `401`.
10. Cambio de estado de una exhibiciÃ³n y verificaciÃ³n de una fila nueva en
    `exhibicion_estado_historial`.
11. `POST /api/v1/popularidad/visitas` dos veces seguidas con la misma sesiÃ³n =
    1 fila nueva (segunda `registrada=false`).
12. `GET /api/v1/admin/monitoreo/sensores` = 12.
13. `GET /api/v1/admin/monitoreo/lecturas-recientes` con datos tras 10-15 s de
    MQTT.
14. `GET /api/v1/admin/monitoreo/resumen` con promedios y presencia.
15. `GET /api/v1/admin/monitoreo/historico` con rango de 1 h y token Influx.
16. `GET /api/v1/admin/monitoreo/salud-outbox` con contadores crecientes.
17. Panel: inicio, exhibiciones, alertas, popularidad, monitoreo, perfil.
18. `npm run build` y `npm run preview`.
19. Recorrido 3D desde `#/recorrido-virtual`.
20. Reinicio del stack y comprobaciÃ³n de que los volÃºmenes conservan datos.

---

## 7. ConclusiÃ³n

El proyecto es **ejecutable hoy** en la modalidad â€œbackend/frontend locales +
servicios IoT en Dockerâ€, siempre que se definan las credenciales y se configuren
las del nodo MQTT de Node-RED. La contenerizaciÃ³n completa **no existe** y se
entrega como propuesta separada. Los defectos mÃ¡s relevantes para una entrega son
la prueba de correo que falla, el JAR desactualizado, el filtro de primer inicio
sin `/admin/alertas`, la falta de credenciales MQTT en el flujo y el crecimiento
del outbox.
