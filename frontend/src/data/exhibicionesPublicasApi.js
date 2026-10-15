// ============================================================
// API pública de exhibiciones — Museo Smart
// ------------------------------------------------------------
// Consulta de solo lectura sobre los endpoints públicos del
// backend (Spring Security los expone con permitAll):
//   GET /api/v1/exhibiciones             -> ExhibicionResponse[]
//   GET /api/v1/salas/{salaId}/exhibiciones -> ExhibicionResponse[]
//
// Devuelve únicamente exhibiciones activas. No envía token: la
// navegación del museo virtual es anónima.
// ============================================================
import { solicitarJson } from './httpClient'

/**
 * Lista las exhibiciones de una sala (solo activas).
 * @param {number} salaId Identificador real de la sala.
 * @param {{signal?: AbortSignal}} [opciones]
 * @returns {Promise<Array>} ExhibicionResponse[]
 */
export function listarExhibicionesPublicas(salaId, { signal } = {}) {
  return solicitarJson(`/salas/${salaId}/exhibiciones`, {
    method: 'GET',
    autenticado: false,
    signal,
  })
}
