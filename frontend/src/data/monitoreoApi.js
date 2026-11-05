// ============================================================
// API de Monitoreo IoT (administración) — Museo Smart
// ------------------------------------------------------------
// Funciones específicas sobre el cliente administrativo común
// (adminApi.js → httpClient.js). No gestiona sesión ni token.
//
// Endpoints reales del backend (ver MonitoreoController):
//   GET /api/v1/admin/monitoreo/sensores           -> SensorMonitoreoResponse[]
//   GET /api/v1/admin/monitoreo/lecturas-recientes -> LecturaResponse[]
//   GET /api/v1/admin/monitoreo/resumen            -> ResumenMonitoreoResponse
//   GET /api/v1/admin/monitoreo/historico          -> HistoricoResponse (InfluxDB)
//
// Requiere rol ADMIN o SUPERADMIN (Spring Security).
// Fuente: PostgreSQL (recientes/resumen) e InfluxDB (histórico).
// ============================================================
import { solicitarAdmin } from './adminApi'

// Ninguna consulta de monitoreo debe quedar colgada: si PostgreSQL, Redis o
// InfluxDB no responden, la petición se aborta y la vista muestra el error con
// su botón Reintentar (en lugar de un "cargando" infinito).
const TIEMPO_LIMITE_MS = 15_000

export function listarSensores({ signal } = {}) {
  return solicitarAdmin('/admin/monitoreo/sensores', {
    method: 'GET',
    signal,
    tiempoLimiteMs: TIEMPO_LIMITE_MS,
  })
}

export function listarLecturasRecientes({ signal } = {}) {
  return solicitarAdmin('/admin/monitoreo/lecturas-recientes', {
    method: 'GET',
    signal,
    tiempoLimiteMs: TIEMPO_LIMITE_MS,
  })
}

export function obtenerResumenMonitoreo({ signal } = {}) {
  return solicitarAdmin('/admin/monitoreo/resumen', {
    method: 'GET',
    signal,
    tiempoLimiteMs: TIEMPO_LIMITE_MS,
  })
}

/**
 * Serie histórica de una métrica desde InfluxDB.
 * @param {{metrica: string, desde: string, hasta: string, sensor?: string, signal?: AbortSignal}} opciones
 *   `desde`/`hasta` en formato ISO-8601 (con zona/offset).
 * @returns {Promise<object>} HistoricoResponse
 */
export function obtenerHistorico({ metrica, desde, hasta, sensor, signal } = {}) {
  const params = new URLSearchParams({ metrica, desde, hasta })
  if (sensor) params.set('sensor', sensor)
  return solicitarAdmin(`/admin/monitoreo/historico?${params.toString()}`, {
    method: 'GET',
    signal,
    tiempoLimiteMs: TIEMPO_LIMITE_MS,
  })
}

/**
 * Estado del outbox de lecturas hacia InfluxDB (contadores por estado).
 * Endpoint real: GET /api/v1/admin/monitoreo/salud-outbox
 * @returns {Promise<object>} SaludOutboxResponse
 */
export function obtenerSaludOutbox({ signal } = {}) {
  return solicitarAdmin('/admin/monitoreo/salud-outbox', {
    method: 'GET',
    signal,
    tiempoLimiteMs: TIEMPO_LIMITE_MS,
  })
}
