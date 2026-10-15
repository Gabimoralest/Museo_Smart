function IconoFlecha() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M5 12h12.2l-4.6-4.6L14 6l7 6-7 6-1.4-1.4 4.6-4.6H5v-2Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function TarjetaSala({ sala, onSeleccionar }) {
  return (
    <button
      type="button"
      className="tarjeta"
      onClick={() => onSeleccionar(sala)}
      aria-label={`Abrir ${sala.nombre}: ${sala.titulo}`}
    >
      <img className="tarjeta__imagen" src={sala.imagen} alt="" />
      <span className="tarjeta__degradado" aria-hidden="true" />
      <span className="tarjeta__info">
        <span className="tarjeta__nombre">{sala.nombre}</span>
        <span className="tarjeta__titulo">{sala.titulo}</span>
      </span>
      <span className="tarjeta__flecha" aria-hidden="true">
        <IconoFlecha />
      </span>
    </button>
  )
}
