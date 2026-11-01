// ============================================================
// Presentación de la ficha de una exhibición — Museo Smart
// ------------------------------------------------------------
// Utilidades compartidas por la vista previa del panel, la ficha del
// ModalSala y la ficha del recorrido 3D. No inventan datos: si un campo
// no existe, simplemente no se muestra.
// ============================================================

// Descripciones provisionales heredadas que NO deben presentarse como
// información definitiva.
const PLACEHOLDERS = new Set(['Registro provisional pendiente de contenido real.'])

export function esProvisional(texto) {
  return typeof texto === 'string' && texto.trim().startsWith('[PROVISIONAL]')
}

/** Devuelve el texto si es un valor real y no un marcador provisional. */
export function valorReal(valor) {
  if (typeof valor !== 'string') return null
  const limpio = valor.trim()
  if (!limpio || PLACEHOLDERS.has(limpio) || esProvisional(limpio)) return null
  return limpio
}

/** Una exhibición es mostrable si tiene título real. */
export function exhibicionMostrable(exhibicion) {
  return Boolean(exhibicion && valorReal(exhibicion.titulo))
}

/** Etiqueta de la sala: nombre real o "Plaza central" para la especial. */
export function etiquetaSala(exhibicion) {
  if (!exhibicion) return null
  if (exhibicion.especial) return 'Plaza central'
  return valorReal(exhibicion.salaNombre)
}

/** Línea "cultura o procedencia · época". */
export function lineaProcedencia(exhibicion) {
  if (!exhibicion) return null
  const cultura = valorReal(exhibicion.autorCultura)
  const epoca = valorReal(exhibicion.periodo)
  if (cultura && epoca) return `${cultura} · ${epoca}`
  return cultura || epoca || null
}

/** Primera vista de la ficha: lo mínimo que se muestra siempre. */
export function primeraVista(exhibicion) {
  if (!exhibicion) return null
  return {
    titulo: valorReal(exhibicion.titulo),
    procedencia: lineaProcedencia(exhibicion),
    sala: etiquetaSala(exhibicion),
    descripcionCorta: valorReal(exhibicion.descripcionCorta),
  }
}

/** Campos de "Ver más". Se omiten los que estén vacíos. */
export function verMas(exhibicion) {
  if (!exhibicion) return []
  const campos = []
  const agregar = (etiqueta, valor) => {
    const texto = valorReal(valor)
    if (texto) campos.push({ etiqueta, valor: texto })
  }
  agregar('Categoría', exhibicion.categoria)
  agregar('Materiales', exhibicion.material)
  agregar('Descripción completa', exhibicion.descripcion)
  agregar('Dato curioso', exhibicion.datoCurioso)
  return campos
}
