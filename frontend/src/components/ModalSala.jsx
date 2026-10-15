import { useEffect, useRef, useState, useCallback } from 'react'
import { listarExhibicionesPublicas } from '../data/exhibicionesPublicasApi'
import { registrarVisita } from '../data/popularidadPublicaApi'
import { obtenerSesionAnonima } from '../data/sesionAnonima'
import { imagenExhibicion } from '../data/exhibicionesData'
import { ErrorHttp } from '../data/httpClient'

// Recursos visuales locales reutilizados de forma estable por id (el backend
// aún no expone la imagen de cada exhibición). No son datos de negocio.
const IMAGENES_DISPONIBLES = [
  '01-mascara-ceremonial.jpg',
  '02-fosil-ammonite.jpg',
  '03-vasija-ceramica.jpg',
  '04-retrato-historico.jpg',
  '05-textil-ancestral.jpg',
  '06-orfebreria-muisca.jpg',
  '07-escultura-litica.jpg',
  '08-restos-oseos.jpg',
]

function imagenPara(exhibicionId) {
  const id = Number(exhibicionId)
  const indice = Number.isFinite(id) && id > 0 ? (id - 1) % IMAGENES_DISPONIBLES.length : 0
  return imagenExhibicion(IMAGENES_DISPONIBLES[indice])
}

function mensajeDeError(error, porDefecto) {
  if (error instanceof ErrorHttp) {
    if (error.tipo === 'conexion') {
      return 'No pudimos cargar las exhibiciones. Verifica tu conexión.'
    }
    return error.message || porDefecto
  }
  return porDefecto
}

export default function ModalSala({ sala, onCerrar }) {
  const cerrarRef = useRef(null)

  const [exhibiciones, setExhibiciones] = useState([])
  const [cargando, setCargando] = useState(false)
  const [errorCarga, setErrorCarga] = useState(null)
  const [seleccionada, setSeleccionada] = useState(null)

  // Carga de las exhibiciones reales de la sala al abrir el modal.
  useEffect(() => {
    if (!sala) return undefined

    const controlador = new AbortController()
    setCargando(true)
    setErrorCarga(null)
    setSeleccionada(null)

    listarExhibicionesPublicas(sala.id, { signal: controlador.signal })
      .then((datos) => {
        setExhibiciones(Array.isArray(datos) ? datos : [])
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return
        setExhibiciones([])
        setErrorCarga(mensajeDeError(error, 'No se pudieron cargar las exhibiciones.'))
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCargando(false)
      })

    return () => controlador.abort()
  }, [sala])

  // Manejo de teclado / scroll del modal.
  useEffect(() => {
    if (!sala) return undefined

    const alPulsarTecla = (evento) => {
      if (evento.key === 'Escape') {
        if (seleccionada) {
          setSeleccionada(null)
        } else {
          onCerrar()
        }
      }
    }

    document.addEventListener('keydown', alPulsarTecla)
    document.body.style.overflow = 'hidden'
    cerrarRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', alPulsarTecla)
      document.body.style.overflow = ''
    }
  }, [sala, seleccionada, onCerrar])

  // Interacción del visitante: abrir la ficha de una exhibición.
  // Registra la visita real (fuente CURSOR) sin bloquear la navegación:
  // un fallo de red se ignora para no interrumpir la experiencia.
  const abrirExhibicion = useCallback((exhibicion) => {
    setSeleccionada(exhibicion)
    registrarVisita(Number(exhibicion.id), obtenerSesionAnonima(), {
      fuente: 'CURSOR',
    }).catch(() => {
      // Silencioso a propósito: la visita es telemetría, no navegación.
    })
  }, [])

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

          {seleccionada ? (
            <div className="modal-exhibicion">
              <img
                className="modal-exhibicion__imagen"
                src={imagenPara(seleccionada.id)}
                alt={seleccionada.titulo}
              />
              <h4 className="modal-exhibicion__titulo">{seleccionada.titulo}</h4>
              {seleccionada.codigo && (
                <span className="modal-exhibicion__codigo">{seleccionada.codigo}</span>
              )}
              {seleccionada.descripcion && (
                <p className="modal-exhibicion__descripcion">{seleccionada.descripcion}</p>
              )}
              <button
                type="button"
                className="modal__accion"
                onClick={() => setSeleccionada(null)}
              >
                Volver a la sala
              </button>
            </div>
          ) : (
            <>
              <p className="modal__nota">
                Selecciona una exhibición para conocer su detalle. Recorrer la
                sala no cuenta como interacción; abrir una exhibición sí.
              </p>

              {cargando && (
                <p className="modal-exhibiciones__estado" role="status">
                  Cargando exhibiciones…
                </p>
              )}

              {!cargando && errorCarga && (
                <p className="modal-exhibiciones__estado modal-exhibiciones__estado--error" role="alert">
                  {errorCarga}
                </p>
              )}

              {!cargando && !errorCarga && exhibiciones.length === 0 && (
                <p className="modal-exhibiciones__estado" role="status">
                  Esta sala no tiene exhibiciones disponibles.
                </p>
              )}

              {!cargando && !errorCarga && exhibiciones.length > 0 && (
                <ul className="modal-exhibiciones__lista">
                  {exhibiciones.map((ex) => (
                    <li key={ex.id}>
                      <button
                        type="button"
                        className="modal-exhibicion__tarjeta"
                        onClick={() => abrirExhibicion(ex)}
                      >
                        <img
                          className="modal-exhibicion__thumb"
                          src={imagenPara(ex.id)}
                          alt=""
                        />
                        <span className="modal-exhibicion__info">
                          <span className="modal-exhibicion__nombre">{ex.titulo}</span>
                          {ex.codigo && (
                            <span className="modal-exhibicion__codigo">{ex.codigo}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <button type="button" className="modal__accion" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
