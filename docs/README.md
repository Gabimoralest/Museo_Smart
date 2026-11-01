# Documentación técnica de Museo_Smart

Documentación elaborada a partir de la inspección directa del repositorio
`C:\Users\Gaby\OneDrive\Proyectos\Museo_Smart` (rama `main`, último commit
`05f05e7 Implementacion modelo 3d`).

## Documentos

| Documento | Contenido |
|---|---|
| [01-manual-tecnico.md](01-manual-tecnico.md) | Arquitectura, backend, frontend, base de datos, IoT, seguridad e integraciones. |
| [02-manual-instalacion.md](02-manual-instalacion.md) | Requisitos, instalación desde cero, modos de ejecución, verificación, parada y solución de errores. |
| [03-inventario-configuracion.md](03-inventario-configuracion.md) | Variables de entorno, puertos, servicios, dependencias, usuarios iniciales y secretos. |
| [04-diagnostico-entrega.md](04-diagnostico-entrega.md) | Qué funciona, qué corregir, qué falta y riesgos antes de compartir el repositorio. |
| [05-reemplazar-modelo-3d.md](05-reemplazar-modelo-3d.md) | Cómo etiquetar/exportar/optimizar el GLB y conectarlo con el backend sin tocar código. |
| [propuesta-docker/](propuesta-docker/) | Propuesta **nueva** de contenerización completa (Dockerfiles, Compose, Nginx y plantilla de variables). No está aplicada al proyecto. |

## Reglas de esta documentación

- **Hecho verificado**: se comprobó leyendo el archivo indicado y, cuando se
  indica, ejecutando el proyecto.
- **Inferencia**: se deduce del código pero no se ejecutó.
- **No verificado**: no fue posible comprobarlo en este entorno.
- **Propuesta**: archivo o configuración nueva, creada en `docs/`, que el
  proyecto aún no tiene.

## Verificaciones realmente ejecutadas

| Verificación | Resultado |
|---|---|
| Lectura completa de backend, frontend, migraciones y Docker | Sí |
| Backend arrancado desde `backend/target/museo-smart-backend-0.0.1-SNAPSHOT.jar` | Sí, puerto 8080 |
| `GET /actuator/health` | `200` |
| `GET /api/v1/salas` y `GET /api/v1/exhibiciones` | `200` con datos reales de PostgreSQL |
| `GET /api/v1/admin/exhibiciones` sin token | `401` |
| Consultas de solo lectura a PostgreSQL local `Museo_Smart` | Sí |
| `npm run lint` | 0 errores, 10 advertencias |
| `npm run build` | Correcto (advertencia de chunk > 500 kB) |
| `docker compose config` en `docker/` | Válido (`exit 0`) |
| `docker compose up` | **No ejecutado**: el daemon de Docker Desktop no estaba activo en este entorno |
| Pruebas backend completas | No ejecutadas en su totalidad; se ejecutó `MailServiceSelectionTest` (ver documento 04) |
| Inicio de sesión real con credenciales | **No verificado**: no se dispone de contraseñas |

## Nota sobre archivos generados

Durante la auditoría no se modificó ningún archivo fuente. Las únicas
escrituras fueron:

- `frontend/dist/**`: regenerado por `npm run build` (ya existía y está ignorado
  por git).
- `backend/target/**`: reportes de la prueba ejecutada (ignorado por git).
- `docs/**`: esta documentación, nueva.
