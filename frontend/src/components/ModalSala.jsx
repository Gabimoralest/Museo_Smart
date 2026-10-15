import { useEffect, useRef } from 'react'

export default function ModalSala({ sala, onCerrar }) {
  const cerrarRef = useRef(null)

  useEffect(() => {
    if (!sala) return undefined

    const alPulsarTecla = (evento) => {
      if (evento.key === 'Escape') onCerrar()
    }

    document.addEventListener('keydown', alPulsarTecla)
    document.body.style.overflow = 'hidden'
    cerrarRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', alPulsarTecla)
      document.body.style.overflow = ''
    }
  }, [sala, onCerrar])

  if (!sala) return null

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-titulo"
      onClick={onCerrar}
    >
      <div className="modal__caja" onClick={(evento) => evento.stopPropagation()}>
        <button
          type="button"
          className="modal__cerrar"
          ref={cerrarRef}
          onClick={onCerrar}
          aria-label="Cerrar ventana"
        >
          ×
        </button>

        <img className="modal__imagen" src={sala.imagen} alt="" />

        <div className="modal__cuerpo">
          <span className="modal__nombre">{sala.nombre}</span>
          <h3 className="modal__titulo" id="modal-titulo">
            {sala.titulo}
          </h3>
          <p className="modal__descripcion">{sala.descripcion}</p>

          <p className="modal__nota">
            La exploración de las salas está abierta a todo el público, sin
            necesidad de registrarse.
          </p>

          <button type="button" className="modal__accion" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
