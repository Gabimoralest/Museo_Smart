// ============================================================
// MOCK TEMPORAL DE AUTENTICACIÓN (solo para pruebas locales)
// ------------------------------------------------------------
// Se activa únicamente cuando VITE_MOCK_AUTH=true (ver .env.local).
// NO se usa en producción ni por defecto. Para desactivarlo:
// elimina el archivo .env.local (o quita la variable) y reinicia Vite.
// ============================================================
import { ErrorAutenticacion } from './authApi'

// Códigos/datos de prueba (visibles a propósito: no hay backend real detrás).
export const MOCK_CODIGO_VALIDO = '123456'
export const MOCK_CREDENCIALES = { correo: '6gabymorales@gmail.com', contrasena: 'museo1234' }

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function solicitarRecuperacionMock(_datos, { signal } = {}) {
  await esperar(600)
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
  // Respuesta uniforme (no revela si el correo existe).
  return { mensaje: 'Si el correo está registrado, recibirá un código de recuperación.' }
}

export async function verificarCodigoMock({ codigo }, { signal } = {}) {
  await esperar(600)
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
  if (codigo !== MOCK_CODIGO_VALIDO) {
    throw new ErrorAutenticacion(
      'El código de recuperación no es válido o ha expirado.',
      { estado: 400 },
    )
  }
  return { tokenRestablecimiento: 'mock-token-reset', expiraEnMinutos: 15 }
}

export async function restablecerContrasenaMock(
  { tokenRestablecimiento, nuevaContrasena },
  { signal } = {},
) {
  await esperar(700)
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
  if (!tokenRestablecimiento) {
    throw new ErrorAutenticacion(
      'El token de restablecimiento no es válido o ha expirado.',
      { estado: 400 },
    )
  }
  if (!nuevaContrasena || nuevaContrasena.length < 8) {
    throw new ErrorAutenticacion('La nueva contraseña debe tener al menos 8 caracteres.', {
      estado: 400,
      erroresValidacion: { nuevaContrasena: 'mínimo 8' },
    })
  }
  return {}
}

export async function iniciarSesionMock({ correo, contrasena }, { signal } = {}) {
  await esperar(600)
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
  const ok =
    correo?.trim().toLowerCase() === MOCK_CREDENCIALES.correo &&
    contrasena === MOCK_CREDENCIALES.contrasena
  if (!ok) {
    throw new ErrorAutenticacion('El correo electrónico o la contraseña son incorrectos.', {
      estado: 401,
    })
  }
  // Respuesta simulada con la MISMA forma que el backend real para poder
  // construir una sesión válida (token + rol) sin servidor. Solo para pruebas
  // de UI del panel; el token es ficticio y no autentica contra el backend.
  return {
    token: 'mock-token-superadmin',
    tipo: 'Bearer',
    correo: MOCK_CREDENCIALES.correo,
    rol: 'SUPERADMIN',
    debeCambiarContrasena: false,
    expiraEnMinutos: 60,
  }
}
