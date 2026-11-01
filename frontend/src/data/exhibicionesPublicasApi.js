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

/**
 * Lista todas las exhibiciones activas del museo (catálogo público completo).
 * Se usa para indexar las obras del recorrido 3D por `codigo` en una sola
 * petición, evitando consultas repetidas al pasar el cursor entre obras.
 * @param {{signal?: AbortSignal}} [opciones]
 * @returns {Promise<Array>} ExhibicionResponse[]
 */
export function listarTodasExhibicionesPublicas({ signal } = {}) {
  return solicitarJson('/exhibiciones', {
    method: 'GET',
    autenticado: false,
    signal,
  })
}

/**
 * Lista las salas reales del museo (GET /api/v1/salas). Se usa para derivar las
 * opciones del filtro por sala en el panel, en lugar de una lista estática.
 * @param {{signal?: AbortSignal}} [opciones]
 * @returns {Promise<Array>} SalaResponse[]
 */
export function listarSalasPublicas({ signal } = {}) {
  return solicitarJson('/salas', {
    method: 'GET',
    autenticado: false,
    signal,
  })
}
