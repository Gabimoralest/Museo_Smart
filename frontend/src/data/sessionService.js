// ============================================================
// Servicio de sesión — Museo Smart
// ------------------------------------------------------------
// Centraliza la lectura, escritura y eliminación del JWT y de los
// datos de sesión del administrador. Usa sessionStorage: la sesión
// se mantiene al navegar y recargar, y desaparece al cerrar la
// pestaña.
//
// ADVERTENCIA DE SEGURIDAD: sessionStorage NO protege frente a XSS.
// No almacenamos nunca la contraseña; solo el token y metadatos no
// sensibles de la respuesta de login.
// ============================================================

const CLAVE = 'museo_smart.sesion'

// Campos reales devueltos por POST /api/v1/auth/login.
// { token, tipo, correo, rol, debeCambiarContrasena, expiraEnMinutos }
//
// El nombre del administrador no viene en esa respuesta, pero SÍ viaja como
// claim 'nombre' dentro del JWT (ver JwtService.CLAIM_NOMBRE). Se deriva del
// token para no añadir un endpoint ni modificar el backend. Solo se usa para
// presentación; la autorización sigue siendo responsabilidad del backend.

// Decodifica el payload (segunda parte) de un JWT SIN verificar la firma.
// Devuelve el objeto de claims o null si el token no es decodificable.
function decodificarPayloadJwt(token) {
  try {
    const partes = String(token).split('.')
    if (partes.length !== 3) return null
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/')
    const conRelleno = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const binario = atob(conRelleno)
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder('utf-8').decode(bytes))
  } catch {
    return null
  }
}

function nombreDesdeToken(token) {
  const payload = token ? decodificarPayloadJwt(token) : null
  const nombre = payload?.nombre
  return typeof nombre === 'string' && nombre.trim() ? nombre.trim() : null
}

export function guardarSesion(datos) {
  if (!datos || !datos.token) {
    throw new Error('No se puede guardar la sesión sin token')
  }
  const sesion = {
    token: datos.token,
    tipo: datos.tipo || 'Bearer',
    correo: datos.correo || null,
    nombre: datos.nombre || nombreDesdeToken(datos.token) || null,
    rol: datos.rol || null,
    debeCambiarContrasena: Boolean(datos.debeCambiarContrasena),
    expiraEnMinutos: datos.expiraEnMinutos ?? null,
  }
  sessionStorage.setItem(CLAVE, JSON.stringify(sesion))
  return sesion
}

export function obtenerSesion() {
  const bruto = sessionStorage.getItem(CLAVE)
  if (!bruto) return null
  try {
    const sesion = JSON.parse(bruto)
    if (!sesion || !sesion.token) return null
    // Sesiones antiguas sin 'nombre': se rellena desde el token y se persiste.
    if (!sesion.nombre) {
      const nombre = nombreDesdeToken(sesion.token)
      if (nombre) {
        sesion.nombre = nombre
        sessionStorage.setItem(CLAVE, JSON.stringify(sesion))
      }
    }
    return sesion
  } catch {
    // Dato corrupto: se limpia para no arrastrar estado inválido.
    sessionStorage.removeItem(CLAVE)
    return null
  }
}

export function obtenerToken() {
  return obtenerSesion()?.token ?? null
}

export function limpiarSesion() {
  sessionStorage.removeItem(CLAVE)
}

export function estaAutenticado() {
  return obtenerSesion() !== null
}
