// Rutas públicas del sitio (navegación por hash, sin librería externa).
//
// El proyecto ya usaba `window.location.hash` para `#/recorrido-virtual` y
// `#/admin/...`; este módulo centraliza esa misma mecánica para el sitio
// público y las páginas de error, sin añadir dependencias.

export const RUTAS = {
  inicio: '#/',
  salas: '#/salas',
  acerca: '#/acerca',
  experiencia: '#/experiencia',
  recorrido: '#/recorrido-virtual',
  login: '#/acceso',
  recuperacion: '#/recuperar',
  admin: '#/admin',
}

// Título de la pestaña para cada página.
const TITULOS = {
  inicio: 'Museo Smart · Explora, Aprende y Descubre',
  salas: 'Salas · Museo Smart',
  acerca: 'Acerca de · Museo Smart',
  experiencia: 'Vive la experiencia · Museo Smart',
  recorrido: 'Recorrido virtual · Museo Smart',
  login: 'Acceso · Museo Smart',
  recuperacion: 'Recuperar contraseña · Museo Smart',
  admin: 'Administración · Museo Smart',
  noEncontrada: 'Página no encontrada · Museo Smart',
}

const RUTA_POR_DEFECTO = 'inicio'

// Elimina la query del hash (por ejemplo `#/recorrido-virtual?debug=colisiones`)
// y las barras finales sobrantes, para comparar de forma estable.
function limpiar(hash) {
  const sinQuery = String(hash || '').split('?')[0]
  if (sinQuery.length > 1 && sinQuery.endsWith('/')) return sinQuery.slice(0, -1)
  return sinQuery
}

// Interpreta el hash actual y devuelve la clave de página.
export function leerRuta(hash = window.location.hash) {
  const actual = limpiar(hash)

  if (!actual || actual === '#' || actual === '#/') return 'inicio'
  if (actual === RUTAS.salas) return 'salas'
  if (actual === RUTAS.acerca) return 'acerca'
  if (actual === RUTAS.experiencia) return 'experiencia'
  if (actual === RUTAS.recorrido) return 'recorrido'
  if (actual === RUTAS.login || actual === '#/login') return 'login'
  if (actual === RUTAS.recuperacion) return 'recuperacion'
  if (actual === RUTAS.admin || actual.startsWith('#/admin') || actual === '#gestion-exhibiciones') {
    return 'admin'
  }
  return 'noEncontrada'
}

// ¿La página forma parte del sitio público (cabecera y pie común)?
export function esPaginaPublica(pagina) {
  return ['inicio', 'salas', 'acerca', 'experiencia', 'noEncontrada'].includes(pagina)
}

export function tituloDe(pagina) {
  return TITULOS[pagina] || TITULOS[RUTA_POR_DEFECTO]
}
