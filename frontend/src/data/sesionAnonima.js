// ============================================================
// Sesión anónima del visitante — Museo Smart
// ------------------------------------------------------------
// Identificador opaco (UUID) sin datos personales que el backend
// usa para deduplicar interacciones dentro de una ventana de un
// minuto. Se conserva en sessionStorage: se mantiene al navegar y
// recargar, y desaparece al cerrar la pestaña.
//
// Cumple el contrato de POST /api/v1/popularidad/visitas:
// sesion_anonima_id debe ser un UUID válido.
// ============================================================

const CLAVE = 'museo_smart.sesion_anonima'

const PATRON_UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function uuidV4() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Reserva para navegadores sin crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function esUuidValido(valor) {
  return typeof valor === 'string' && PATRON_UUID.test(valor)
}

/**
 * Devuelve el identificador de sesión anónima, generándolo si no
 * existe o si el almacenado es inválido. Nunca lanza: si el
 * almacenamiento no está disponible, devuelve un UUID efímero.
 */
export function obtenerSesionAnonima() {
  try {
    const actual = sessionStorage.getItem(CLAVE)
    if (esUuidValido(actual)) {
      return actual
    }
    const nuevo = uuidV4()
    sessionStorage.setItem(CLAVE, nuevo)
    return nuevo
  } catch {
    return uuidV4()
  }
}
