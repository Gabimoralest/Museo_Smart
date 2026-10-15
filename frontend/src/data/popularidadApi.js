// ============================================================
// API de popularidad (administración) — Museo Smart
// ------------------------------------------------------------
// Funciones específicas sobre el cliente administrativo común
// (adminApi.js → httpClient.js). No gestiona sesión ni token.
//
// Endpoint real del backend (ver PopularidadAdminController):
//   GET /api/v1/admin/popularidad/ranking?limite={n} -> RankingExhibicionResponse[]
//
// Requiere rol ADMIN o SUPERADMIN (Spring Security).
//
// El backend ya devuelve las filas ordenadas por visitas válidas
// descendente y, en caso de empate, por título ascendente, con la
// posición calculada (los empates comparten posición).
// ============================================================
import { solicitarAdmin } from './adminApi'

/**
 * Obtiene el ranking de popularidad. Si se indica `limite`, devuelve como
 * máximo esa cantidad de filas; si no, el ranking completo.
 * @param {{limite?: number, signal?: AbortSignal}} [opciones]
 * @returns {Promise<Array>} RankingExhibicionResponse[]
 */
export function obtenerRanking({ limite, signal } = {}) {
  const query = Number.isInteger(limite) && limite > 0 ? `?limite=${limite}` : ''
  return solicitarAdmin(`/admin/popularidad/ranking${query}`, { method: 'GET', signal })
}
