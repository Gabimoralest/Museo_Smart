import { solicitarJson, ErrorHttp } from './httpClient'

// MODO PRUEBA: si VITE_MOCK_AUTH=true, se usan respuestas simuladas y no se
// llama al backend. Se controla desde .env.local (no versionado).
export const MODO_MOCK = import.meta.env.VITE_MOCK_AUTH === 'true'

// Rutas reales del backend (relativas a la base /api/v1).
export const RUTA_LOGIN = '/auth/login'
export const RUTA_RECUPERACION = '/auth/recuperacion/solicitar'
export const RUTA_VERIFICAR_CODIGO = '/auth/recuperacion/verificar'
export const RUTA_RESTABLECER = '/auth/recuperacion/restablecer'
export const RUTA_CAMBIAR_CONTRASENA = '/auth/cambiar-contrasena'

// El backend solo exige longitud mínima de 8 caracteres para la contraseña
// (ver RestablecerContrasenaRequest). Mayúscula y número se muestran como
// recomendaciones visuales, no como reglas reales.
export const LONGITUD_MINIMA_CONTRASENA = 8

// Error de autenticación/API. Se mantiene el nombre para compatibilidad con
// las pantallas existentes; internamente es el error del cliente HTTP.
export class ErrorAutenticacion extends ErrorHttp {}

// Traduce un ErrorHttp a ErrorAutenticacion conservando estado y validaciones.
function comoErrorAutenticacion(error) {
  if (error instanceof ErrorAutenticacion) return error
  if (error instanceof ErrorHttp) {
    return new ErrorAutenticacion(error.message, {
      estado: error.estado,
      erroresValidacion: error.erroresValidacion,
      tipo: error.tipo,
    })
  }
  return error
}

async function ejecutar(promesa) {
  try {
    return await promesa
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw comoErrorAutenticacion(error)
  }
}

export async function iniciarSesion({ correo, contrasena }, { signal } = {}) {
  if (MODO_MOCK) {
    const { iniciarSesionMock } = await import('./authApiMock')
    return iniciarSesionMock({ correo, contrasena }, { signal })
  }
  // Devuelve { token, tipo, correo, rol, debeCambiarContrasena, expiraEnMinutos }.
  return ejecutar(
    solicitarJson(RUTA_LOGIN, {
      method: 'POST',
      datos: { correo, contrasena },
      autenticado: false,
      signal,
    }),
  )
}

export async function solicitarRecuperacion({ correo }, { signal } = {}) {
  if (MODO_MOCK) {
    const { solicitarRecuperacionMock } = await import('./authApiMock')
    return solicitarRecuperacionMock({ correo }, { signal })
  }
  // Respuesta uniforme del backend: no revela si el correo existe.
  return ejecutar(
    solicitarJson(RUTA_RECUPERACION, {
      method: 'POST',
      datos: { correo },
      autenticado: false,
      signal,
    }),
  )
}

export async function verificarCodigo({ correo, codigo }, { signal } = {}) {
  if (MODO_MOCK) {
    const { verificarCodigoMock } = await import('./authApiMock')
    return verificarCodigoMock({ correo, codigo }, { signal })
  }
  // Devuelve { tokenRestablecimiento, expiraEnMinutos }.
  const resultado = await ejecutar(
    solicitarJson(RUTA_VERIFICAR_CODIGO, {
      method: 'POST',
      datos: { correo, codigo },
      autenticado: false,
      signal,
    }),
  )
  return {
    tokenRestablecimiento: resultado.tokenRestablecimiento,
    expiraEnMinutos: resultado.expiraEnMinutos,
  }
}

export async function restablecerContrasena(
  { tokenRestablecimiento, nuevaContrasena },
  { signal } = {},
) {
  if (MODO_MOCK) {
    const { restablecerContrasenaMock } = await import('./authApiMock')
    return restablecerContrasenaMock({ tokenRestablecimiento, nuevaContrasena }, { signal })
  }
  // 204 sin cuerpo cuando el backend confirma el cambio.
  return ejecutar(
    solicitarJson(RUTA_RESTABLECER, {
      method: 'POST',
      datos: { tokenRestablecimiento, nuevaContrasena },
      autenticado: false,
      signal,
    }),
  )
}
