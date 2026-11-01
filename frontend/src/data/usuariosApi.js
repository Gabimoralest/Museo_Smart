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
//   PUT    /api/v1/admin/usuarios/{id} -> UsuarioAdminResponse (nombre, correo)
//   PATCH  /api/v1/admin/usuarios/{id}/estado -> UsuarioAdminResponse (estado)
//   DELETE /api/v1/admin/usuarios/{id} -> 204
//
// Modelo fijo: las cuentas gestionadas aquí son siempre ADMIN. El SUPERADMIN
// único se crea desde el backend y no se edita/desactiva/elimina desde el panel.
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
  // El rol no se envía: el backend crea siempre cuentas ADMIN.
  return solicitarAdmin('/admin/usuarios', {
    method: 'POST',
    datos: { nombre, correo, contrasena },
    signal,
  })
}

/**
 * Actualiza nombre y correo de una cuenta ADMIN. El backend no modifica la
 * contraseña ni el rol; tampoco se envía el rol.
 *
 * @param {number} id
 * @param {{nombre: string, correo: string}} datos
 * @param {{signal?: AbortSignal}} [opciones]
 * @returns {Promise<object>} UsuarioAdminResponse actualizado
 */
export function actualizarUsuario(id, { nombre, correo }, { signal } = {}) {
  return solicitarAdmin(`/admin/usuarios/${id}`, {
    method: 'PUT',
    datos: { nombre, correo },
    signal,
  })
}

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
