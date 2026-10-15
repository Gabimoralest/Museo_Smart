// ============================================================
// API de exhibiciones (administración) — Museo Smart
// ------------------------------------------------------------
// Funciones específicas sobre el cliente administrativo común
// (adminApi.js → httpClient.js). No gestiona sesión ni token: eso
// queda en httpClient/sessionService.
//
// Endpoints reales del backend (ver ExhibicionAdminController):
//   GET   /api/v1/admin/exhibiciones            -> ExhibicionResponse[]
//   PATCH /api/v1/admin/exhibiciones/{id}/estado -> ExhibicionResponse
//         cuerpo: { activa: boolean, motivo?: string }
//
// Requieren rol ADMIN o SUPERADMIN (Spring Security).
// ============================================================
import { solicitarAdmin } from './adminApi'

/**
 * Lista todas las exhibiciones (incluidas las inactivas).
 * @param {{signal?: AbortSignal}} [opciones]
 * @returns {Promise<Array>} ExhibicionResponse[]
 */
export function listarExhibiciones({ signal } = {}) {
  return solicitarAdmin('/admin/exhibiciones', { method: 'GET', signal })
}

/**
 * Activa o desactiva una exhibición. El cambio persiste en PostgreSQL.
 * @param {number} id  Identificador numérico real de la exhibición.
 * @param {boolean} activa  Nuevo estado.
 * @param {string} [motivo]  Motivo opcional (lo registra el historial).
 * @param {{signal?: AbortSignal}} [opciones]
 * @returns {Promise<object>} ExhibicionResponse actualizada
 */
export function cambiarEstadoExhibicion(id, activa, motivo, { signal } = {}) {
  return solicitarAdmin(`/admin/exhibiciones/${id}/estado`, {
    method: 'PATCH',
    datos: { activa, ...(motivo ? { motivo } : {}) },
    signal,
  })
}
