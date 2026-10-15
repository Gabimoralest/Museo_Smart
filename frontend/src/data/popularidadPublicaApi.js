// ============================================================
// API pública de popularidad — Museo Smart
// ------------------------------------------------------------
// Registra interacciones anónimas de visitantes con exhibiciones.
//
// Endpoint real del backend (PopularidadController):
//   POST /api/v1/popularidad/visitas
//     body: { exhibicionId, sesionAnonimaId, fuente }
//     -> 201 { registrada, exhibicionId }
//
// No requiere autenticación; no se envía token. La fuente CURSOR
// identifica la interacción del visitante en el museo virtual.
// El backend deduplica por (exhibición, sesión, fuente, minuto).
// ============================================================
import { solicitarJson } from './httpClient'

export const FUENTE_CURSOR = 'CURSOR'

// Ventana de deduplicación local (ms), alineada con la del backend
// (buckets de 1 minuto). Evita disparar repetidamente el mismo registro
// en el cliente (p. ej. StrictMode, remounts o reaperturas de la misma
// ficha) sin depender de que el backend lo absorba. La autoridad real
// de deduplicación sigue siendo el backend.
const VENTANA_DEDUP_MS = 60_000

// exhibicionId -> timestamp de la última solicitud de registro aceptada.
const ultimoRegistro = new Map()

/**
 * Registra una interacción del visitante con una exhibición.
 *
 * Se marca como no autenticada (endpoint público). No añade manejo de
 * errores propio: el llamador decide si fallar aquí debe ser visible
 * o silencioso, para no bloquear la navegación del visitante.
 *
 * @param {number} exhibicionId Identificador real de la exhibición.
 * @param {string} sesionAnonimaId UUID opaco de sesión del navegador.
 * @param {{fuente?: string, signal?: AbortSignal}} [opciones]
 * @returns {Promise<{registrada: boolean, exhibicionId: number}>}
 */
export function registrarVisita(
  exhibicionId,
  sesionAnonimaId,
  { fuente = FUENTE_CURSOR, signal } = {},
) {
  const ahora = Date.now()
  const previo = ultimoRegistro.get(exhibicionId)
  if (previo != null && ahora - previo < VENTANA_DEDUP_MS) {
    // Dentro de la ventana: no se repite la llamada. Se resuelve con el
    // mismo contrato que el backend usaría para un duplicado.
    return Promise.resolve({ registrada: false, exhibicionId })
  }
  ultimoRegistro.set(exhibicionId, ahora)

  return solicitarJson('/popularidad/visitas', {
    method: 'POST',
    datos: { exhibicionId, sesionAnonimaId, fuente },
    autenticado: false,
    signal,
  }).catch((error) => {
    // Si la llamada falla (p. ej. red caída), se libera la marca para
    // permitir un reintento en la próxima interacción del visitante.
    if (error?.name !== 'AbortError') {
      ultimoRegistro.delete(exhibicionId)
    }
    throw error
  })
}
