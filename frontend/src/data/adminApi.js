// ============================================================
// Cliente API administrativo — Museo Smart
// ------------------------------------------------------------
// Infraestructura reutilizable para llamar a los endpoints
// administrativos del backend (/api/v1/admin/... y cualquier ruta
// que requiera autenticación).
//
// NO duplica la lógica de autenticación: reutiliza `solicitarJson`
// de httpClient.js, que es quien adjunta el encabezado
// `Authorization: Bearer <token>` cuando se marca la petición como
// `autenticado: true`. Tampoco gestiona la sesión: usa el token que
// ya administra sessionService.js a través de httpClient.
//
// En esta etapa solo se prepara la base común. Las funciones
// concretas de exhibiciones, alertas, popularidad y administradores
// se implementarán en sus respectivas etapas reutilizando este
// helper.
// ============================================================
import { solicitarJson } from './httpClient'

/**
 * Realiza una petición autenticada a la API administrativa.
 *
 * Envuelve `solicitarJson` forzando `autenticado: true`, de modo que
 * todas las llamadas administrativas compartan el mismo manejo de
 * token, errores (ErrorHttp) y limpieza de sesión ante 401.
 *
 * @param {string} ruta   Ruta relativa a la base (/api/v1). Ej.: '/admin/usuarios'.
 * @param {object} [opciones]
 * @param {string} [opciones.method='GET']
 * @param {object} [opciones.datos]  Cuerpo JSON a enviar.
 * @param {AbortSignal} [opciones.signal]
 * @returns {Promise<object>} Cuerpo de la respuesta (o {} si 204).
 */
export function solicitarAdmin(ruta, opciones = {}) {
  return solicitarJson(ruta, { ...opciones, autenticado: true })
}
