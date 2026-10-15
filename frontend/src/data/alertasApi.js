// ============================================================
// API de alertas (administración) — Museo Smart
// ------------------------------------------------------------
// Funciones específicas sobre el cliente administrativo común
// (adminApi.js → httpClient.js). No gestiona sesión ni token.
//
// Endpoints reales del backend (ver AlertaController):
//   GET   /api/v1/admin/alertas?todas={bool} -> AlertaResponse[]
//   PATCH /api/v1/admin/alertas/{id}/resolver -> AlertaResponse
//
// Requiere rol ADMIN o SUPERADMIN (Spring Security).
// ============================================================
import { solicitarAdmin } from './adminApi'

/**
 * Lista alertas. Por defecto solo las activas (ABIERTA/RECONOCIDA); con
 * `todas: true` devuelve el histórico completo.
 * @param {{todas?: boolean, signal?: AbortSignal}} [opciones]
 * @returns {Promise<Array>} AlertaResponse[]
 */
export function listarAlertas({ todas = false, signal } = {}) {
  const query = todas ? '?todas=true' : ''
  return solicitarAdmin(`/admin/alertas${query}`, { method: 'GET', signal })
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
