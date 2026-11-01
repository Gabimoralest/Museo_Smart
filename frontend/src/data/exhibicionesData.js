// ============================================================
// Recursos y opciones de exhibiciones — Museo_Smart
// ------------------------------------------------------------
// Ya NO contiene datos simulados de exhibiciones: el listado y la
// edición usan la API real. Aquí solo quedan los recursos visuales y
// las opciones de filtros que no dependen de la base de datos.
// ============================================================

const base = import.meta.env.BASE_URL || '/'

export const imagenExhibicion = (archivo) =>
  `${base.replace(/\/$/, '')}/images/exhibiciones/${archivo}`

export const OPCIONES_ESTADO = [
  { valor: 'todos', etiqueta: 'Todos los estados' },
  { valor: 'activas', etiqueta: 'Solo activas' },
  { valor: 'inactivas', etiqueta: 'Solo inactivas' },
]

export const OPCIONES_ORDEN = [
  { valor: 'nombre-asc', etiqueta: 'Nombre (A - Z)' },
  { valor: 'nombre-desc', etiqueta: 'Nombre (Z - A)' },
  { valor: 'sala-asc', etiqueta: 'Sala (1 - 6)' },
  { valor: 'estado-activas', etiqueta: 'Estado (Activas primero)' },
  { valor: 'estado-inactivas', etiqueta: 'Estado (Inactivas primero)' },
]
