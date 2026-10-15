// ============================================================
// API de administradores (usuarios) — Museo Smart
// ------------------------------------------------------------
// Funciones específicas sobre el cliente administrativo común
// (adminApi.js → httpClient.js). No gestiona sesión ni token: eso
// queda en httpClient/sessionService.
//
// Endpoints reales del backend (ver UsuarioAdminController):
//   GET    /api/v1/admin/usuarios -> UsuarioAdminResponse[]
//   POST   /api/v1/admin/usuarios -> UsuarioAdminResponse (cuerpo UsuarioAdminRequest)
//   PUT    /api/v1/admin/usuarios/{id} -> UsuarioAdminResponse (nombre, correo, rol)
//   PATCH  /api/v1/admin/usuarios/{id}/estado -> UsuarioAdminResponse (estado)
//   DELETE /api/v1/admin/usuarios/{id} -> 204
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

/**
 * Actualiza nombre y correo de una cuenta. El backend NO modifica la
 * contraseña ni el rol (el rol solo debe ser válido para pasar la validación
 * del DTO). Por eso se reenvía el rol actual como-etiqueta-backend.
 *
 * @param {number} id
 * @param {{nombre: string, correo: string, rolBackend: string}} datos
 * @param {{signal?: AbortSignal}} [opciones]
 * @returns {Promise<object>} UsuarioAdminResponse actualizado
 */
export function actualizarUsuario(id, { nombre, correo, rolBackend }, { signal } = {}) {
  return solicitarAdmin(`/admin/usuarios/${id}`, {
    method: 'PUT',
    datos: { nombre, correo, rol: rolBackend },
    signal,
  })
}

/**
 * Cambia el estado de una cuenta.
 * @param {number} id
 * @param {'ACTIVO'|'INACTIVO'|'BLOQUEADO'} estado
 * @param {{signal?: AbortSignal}} [opciones]
 * @returns {Promise<object>} UsuarioAdminResponse actualizado
 */
export function cambiarEstadoUsuario(id, estado, { signal } = {}) {
  return solicitarAdmin(`/admin/usuarios/${id}/estado`, {
    method: 'PATCH',
    datos: { estado },
    signal,
  })
}

/**
 * Elimina una cuenta de administrador.
 * @param {number} id
 * @param {{signal?: AbortSignal}} [opciones]
 * @returns {Promise<object>} {} (204 sin cuerpo)
 */
export function eliminarUsuario(id, { signal } = {}) {
  return solicitarAdmin(`/admin/usuarios/${id}`, { method: 'DELETE', signal })
}
