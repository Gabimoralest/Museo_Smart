// ============================================================
// API de administradores (usuarios) — Museo Smart
// ------------------------------------------------------------
// Funciones específicas sobre el cliente administrativo común
// (adminApi.js → httpClient.js). No gestiona sesión ni token: eso
// queda en httpClient/sessionService.
//
// Endpoints reales del backend (ver UsuarioAdminController):
//   GET  /api/v1/admin/usuarios -> UsuarioAdminResponse[]
//   POST /api/v1/admin/usuarios -> UsuarioAdminResponse (cuerpo UsuarioAdminRequest)
//
// Requiere rol SUPERADMIN (Spring Security).
// ============================================================
import { solicitarAdmin } from './adminApi'

/**
 * Lista todas las cuentas de administrador.
 * @param {{signal?: AbortSignal}} [opciones]
 * @returns {Promise<Array>} UsuarioAdminResponse[]
 */
export function listarUsuarios({ signal } = {}) {
  return solicitarAdmin('/admin/usuarios', { method: 'GET', signal })
}

/**
 * Crea una cuenta de administrador.
 *
 * El backend exige exactamente los campos del DTO UsuarioAdminRequest:
 * nombre, correo, rol y contrasena (grupo de validación OnCreate).
 * El estado inicial (ACTIVO) y primerInicioSesion=true los fija el
 * servicio del backend, por lo que NO se envían desde el cliente.
 *
 * @param {{nombre: string, correo: string, contrasena: string}} datos
 * @param {{signal?: AbortSignal}} [opciones]
 * @returns {Promise<object>} UsuarioAdminResponse creado
 */
export function crearUsuario({ nombre, correo, contrasena }, { signal } = {}) {
  return solicitarAdmin('/admin/usuarios', {
    method: 'POST',
    datos: { nombre, correo, rol: 'ADMIN', contrasena },
    signal,
  })
}
