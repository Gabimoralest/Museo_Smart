// ============================================================
// API de alertas (administración) — Museo Smart
// ------------------------------------------------------------
// Funciones específicas sobre el cliente administrativo común
// (adminApi.js → httpClient.js). No gestiona sesión ni token.
//
// Endpoints reales del backend (ver AlertaController):
//   GET   /api/v1/admin/alertas?todas={bool} -> AlertaResponse[]
//   GET   /api/v1/admin/alertas/resumen       -> { abiertas }
//   PATCH /api/v1/admin/alertas/{id}/resolver -> AlertaResponse
//
// Requiere rol ADMIN o SUPERADMIN (Spring Security).
// ============================================================
import { solicitarAdmin } from './adminApi'

// Ninguna consulta debe quedar colgada (Redis caído, etc.). Al agotarse el
// tiempo se lanza un ErrorHttp de conexión y la vista muestra Reintentar.
const TIEMPO_LIMITE_MS = 15_000

/**
 * Lista alertas. Por defecto solo las activas (ABIERTA/RECONOCIDA); con
 * `todas: true` devuelve el histórico completo.
 * @param {{todas?: boolean, signal?: AbortSignal}} [opciones]
 * @returns {Promise<Array>} AlertaResponse[]
 */
export function listarAlertas({ todas = false, signal } = {}) {
  const query = todas ? '?todas=true' : ''
  return solicitarAdmin(`/admin/alertas${query}`, {
    method: 'GET',
    signal,
    tiempoLimiteMs: TIEMPO_LIMITE_MS,
  })
}

/**
 * Numero de alertas activas (ABIERTA/RECONOCIDA) para la campana del panel.
 * El backend lo lee de Redis (o PostgreSQL si Redis no responde).
 * @param {{signal?: AbortSignal}} [opciones]
 * @returns {Promise<{abiertas: number}>}
 */
export function obtenerResumenAlertas({ signal } = {}) {
  return solicitarAdmin('/admin/alertas/resumen', {
    method: 'GET',
    signal,
    tiempoLimiteMs: TIEMPO_LIMITE_MS,
  })
}

/**
 * Resuelve una alerta (la marca RESUELTA si estaba activa).
 * @param {number} id Identificador real de la alerta.
 * @param {{signal?: AbortSignal}} [opciones]
 * @returns {Promise<object>} AlertaResponse actualizada
 */
export function resolverAlerta(id, { signal } = {}) {
  return solicitarAdmin(`/admin/alertas/${id}/resolver`, { method: 'PATCH', signal })
}
