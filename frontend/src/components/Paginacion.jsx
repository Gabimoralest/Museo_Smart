import './Paginacion.css'

/**
 * Calcula la lista de números de página y puntos suspensivos ("…") a mostrar.
 *
 * Reglas:
 * - Si totalPaginas <= 7, se muestran todas las páginas.
 * - Si totalPaginas > 7:
 *   - Siempre la primera (1) y la última página.
 *   - La página actual con 1 vecina a cada lado.
 *   - "…" donde se omiten páginas intermedias (no clicable).
 *   - Ejemplos con 37 páginas:
 *     página 1  -> ‹ 1 2 3 … 37 ›
 *     página 6  -> ‹ 1 … 5 6 7 … 37 ›
 *     página 37 -> ‹ 1 … 35 36 37 ›
 */
function calcularItemsPaginacion(paginaActual, totalPaginas) {
  if (totalPaginas <= 0) return [1]
  if (totalPaginas <= 7) {
    return Array.from({ length: totalPaginas }, (_, i) => i + 1)
  }

  // Casos en los extremos (3 botones continuos en el inicio o final)
  if (paginaActual <= 2) {
    return [1, 2, 3, '…', totalPaginas]
  }

  if (paginaActual >= totalPaginas - 1) {
    return [1, '…', totalPaginas - 2, totalPaginas - 1, totalPaginas]
  }

  // Cuando la página actual es 3 o totalPaginas - 2 (evita "1 … 2 3 4")
  if (paginaActual === 3) {
    return [1, 2, 3, 4, '…', totalPaginas]
  }

  if (paginaActual === totalPaginas - 2) {
    return [1, '…', totalPaginas - 3, totalPaginas - 2, totalPaginas - 1, totalPaginas]
  }

  // Caso general intermedio: 1 … (p-1) p (p+1) … total
  return [1, '…', paginaActual - 1, paginaActual, paginaActual + 1, '…', totalPaginas]
}

/**
 * Componente reutilizable de paginación para las tablas del panel.
 *
 * Props:
 * - paginaActual: número de página activa (base 1).
 * - totalPaginas: total de páginas disponibles.
 * - onCambiar: callback (nuevaPagina) => void.
 */
export default function Paginacion({ paginaActual, totalPaginas, onCambiar }) {
  const total = Math.max(1, Number(totalPaginas) || 1)
  const actual = Math.min(Math.max(1, Number(paginaActual) || 1), total)

  const items = calcularItemsPaginacion(actual, total)

  return (
    <nav className="paginacion" aria-label="Paginación">
      {/* Flecha anterior */}
      <button
        type="button"
        className="paginacion__btn paginacion__btn--flecha"
        disabled={actual <= 1}
        onClick={() => onCambiar?.(actual - 1)}
        aria-label="Página anterior"
      >
        ‹
      </button>

      {/* Resumen para pantallas móviles (< 640px) */}
      <span className="paginacion__resumen-movil">
        Página {actual} de {total}
      </span>

      {/* Botones numéricos y elipsis (pantallas >= 640px) */}
      <div className="paginacion__numeros">
        {items.map((item, index) =>
          item === '…' ? (
            <span
              key={`elipsis-${index}`}
              className="paginacion__elipsis"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`paginacion__btn${item === actual ? ' paginacion__btn--activo' : ''}`}
              onClick={() => onCambiar?.(item)}
              aria-current={item === actual ? 'page' : undefined}
              aria-label={`Página ${item}`}
            >
              {item}
            </button>
          )
        )}
      </div>

      {/* Flecha siguiente */}
      <button
        type="button"
        className="paginacion__btn paginacion__btn--flecha"
        disabled={actual >= total}
        onClick={() => onCambiar?.(actual + 1)}
        aria-label="Página siguiente"
      >
        ›
      </button>
    </nav>
  )
}
