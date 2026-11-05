// ============================================================
// Cliente HTTP compartido — Museo Smart
// ------------------------------------------------------------
// Envuelve fetch. No añade dependencias externas (sin Axios).
// El header Authorization: Bearer se incorpora SOLO cuando la
// petición se marca como autenticada (autenticado: true). Las
// peticiones públicas y el propio login no envían el token.
// ============================================================
import { obtenerToken, limpiarSesion } from './sessionService'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

export class ErrorHttp extends Error {
  constructor(mensaje, { estado = 0, erroresValidacion = null, tipo = 'desconocido' } = {}) {
    super(mensaje)
    this.name = 'ErrorHttp'
    this.estado = estado
    this.erroresValidacion = erroresValidacion
    this.tipo = tipo // 'conexion' | 'cliente' | 'servidor' | 'autorizacion'
  }
}

function errorDeConexion() {
  return new ErrorHttp(
    'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
    { estado: 0, tipo: 'conexion' },
  )
}

function clasificar(estado) {
  if (estado === 401 || estado === 403) return 'autorizacion'
  if (estado >= 500) return 'servidor'
  if (estado >= 400) return 'cliente'
  return 'desconocido'
}

// Interpreta la respuesta uniforme de error del backend (ApiErrorResponse):
// { timestamp, status, error, mensaje, ruta, erroresValidacion }
function construirError(cuerpo, estado) {
  const mensaje =
    cuerpo?.mensaje ||
    (estado >= 500
      ? 'Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.'
      : 'Ocurrió un error inesperado. Inténtalo de nuevo.')
  return new ErrorHttp(mensaje, {
    estado,
    erroresValidacion: cuerpo?.erroresValidacion ?? null,
    tipo: clasificar(estado),
  })
}

/**
 * Realiza una petición JSON al backend.
 *
 * @param {string} ruta  Ruta relativa (p. ej. '/auth/login') o absoluta.
 * @param {object} opciones
 * @param {string} [opciones.method='GET']
 * @param {object} [opciones.datos]      Cuerpo a serializar como JSON.
 * @param {boolean} [opciones.autenticado=false] Añade Authorization: Bearer.
 * @param {AbortSignal} [opciones.signal]
 * @param {number} [opciones.tiempoLimiteMs] Aborta la petición si tarda más.
 */
export async function solicitarJson(ruta, opciones = {}) {
  const { method = 'GET', datos, autenticado = false, signal, tiempoLimiteMs } = opciones

  const headers = {}
  if (datos !== undefined) headers['Content-Type'] = 'application/json'

  if (autenticado) {
    const token = obtenerToken()
    if (token) {
      headers.Authorization = `Bearer ${token}`
    } else {
      // Petición autenticada sin token: se rechaza antes de llamar al servidor.
      throw new ErrorHttp('Tu sesión ha expirado. Inicia sesión de nuevo.', {
        estado: 401,
        tipo: 'autorizacion',
      })
    }
  }

  const url = ruta.startsWith('http') ? ruta : `${API_BASE}${ruta}`

  // Límite de tiempo opcional: evita que un endpoint lento (p. ej. Redis o
  // InfluxDB colgados) deje la interfaz cargando indefinidamente.
  const controlador = new AbortController()
  let tiempoAgotado = false
  let temporizador = null
  const alAbortarExterno = () => controlador.abort()
  if (signal) {
    if (signal.aborted) controlador.abort()
    else signal.addEventListener('abort', alAbortarExterno, { once: true })
  }
  if (tiempoLimiteMs > 0) {
    temporizador = setTimeout(() => {
      tiempoAgotado = true
      controlador.abort()
    }, tiempoLimiteMs)
  }

  let respuesta
  try {
    respuesta = await fetch(url, {
      method,
      headers,
      body: datos !== undefined ? JSON.stringify(datos) : undefined,
      signal: controlador.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      if (tiempoAgotado) {
        throw new ErrorHttp('El servidor tardó demasiado en responder. Inténtalo de nuevo.', {
          estado: 0,
          tipo: 'conexion',
        })
      }
      throw error
    }
    throw errorDeConexion()
  } finally {
    if (temporizador) clearTimeout(temporizador)
    if (signal) signal.removeEventListener('abort', alAbortarExterno)
  }

  let cuerpo = null
  if (respuesta.status !== 204) {
    try {
      cuerpo = await respuesta.json()
    } catch {
      cuerpo = null
    }
  }

  if (!respuesta.ok) {
    // Un 401 en una petición autenticada invalida la sesión local.
    if (respuesta.status === 401 && autenticado) {
      limpiarSesion()
    }
    throw construirError(cuerpo, respuesta.status)
  }

  return cuerpo ?? {}
}
