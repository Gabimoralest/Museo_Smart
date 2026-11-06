// ============================================================
// API del simulador de demostración (solo SUPERADMIN)
// ------------------------------------------------------------
// Endpoints (solo existen si APP_SIMULADOR_HABILITADO=true en el backend):
//   GET  /api/v1/admin/simulador/escenarios  -> estado actual
//   POST /api/v1/admin/simulador/escenarios  { tipo, sala | sensorCodigo }
//   POST /api/v1/admin/simulador/restablecer { sala | sensorCodigo | todo }
//   POST /api/v1/admin/simulador/horario     { activo }
//
// Con el flag en false el backend responde 404: la sección no se muestra.
// ============================================================
import { solicitarAdmin } from './adminApi'

const TIEMPO_LIMITE_MS = 15_000

/** Escenarios activos publicados por Node-RED (retained). */
export function obtenerEscenarios({ signal } = {}) {
  return solicitarAdmin('/admin/simulador/escenarios', {
    method: 'GET',
    signal,
    tiempoLimiteMs: TIEMPO_LIMITE_MS,
  })
}

/** Activa un escenario. `sala` o `sensorCodigo` según el tipo. */
export function activarEscenario({ tipo, sala, sensorCodigo }, { signal } = {}) {
  const datos = { tipo }
  if (sala != null && sala !== '') datos.sala = String(sala)
  if (sensorCodigo != null && sensorCodigo !== '') datos.sensorCodigo = String(sensorCodigo)
  return solicitarAdmin('/admin/simulador/escenarios', {
    method: 'POST',
    datos,
    signal,
    tiempoLimiteMs: TIEMPO_LIMITE_MS,
  })
}

/** Restablece una sala, un sensor o todos los escenarios. */
export function restablecerEscenarios({ sala, sensorCodigo, todo }, { signal } = {}) {
  const datos = {}
  if (todo) datos.todo = true
  if (sala != null && sala !== '') datos.sala = String(sala)
  if (sensorCodigo != null && sensorCodigo !== '') datos.sensorCodigo = String(sensorCodigo)
  return solicitarAdmin('/admin/simulador/restablecer', {
    method: 'POST',
    datos,
    signal,
    tiempoLimiteMs: TIEMPO_LIMITE_MS,
  })
}

/** Activa o desactiva el horario de visita forzado. */
export function cambiarHorarioForzado(activo, { signal } = {}) {
  return solicitarAdmin('/admin/simulador/horario', {
    method: 'POST',
    datos: { activo: Boolean(activo) },
    signal,
    tiempoLimiteMs: TIEMPO_LIMITE_MS,
  })
}
