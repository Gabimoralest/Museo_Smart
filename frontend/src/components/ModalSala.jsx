import { useEffect, useRef, useState, useCallback } from 'react'
import { listarExhibicionesPublicas } from '../data/exhibicionesPublicasApi'
import { registrarVisita } from '../data/popularidadPublicaApi'
import { obtenerSesionAnonima } from '../data/sesionAnonima'
import { urlMedia } from '../data/exhibicionesApi'
import { ErrorHttp } from '../data/httpClient'
import { portadasDeSala } from '../data/salasPublicas'
import FichaVisitante from './FichaVisitante'

function mensajeDeError(error, porDefecto) {
  if (error instanceof ErrorHttp) {
    if (error.tipo === 'conexion') {
      return 'No pudimos cargar las exhibiciones. Verifica tu conexión.'
    }
    return error.message || porDefecto
  }
  return porDefecto
}
/**
 * Portada de la sala en el modal. Usa las imágenes de `public/salas` por
 * `codigo3d` y, si falta el archivo, muestra un marcador neutro con el nombre.
 */
function ImagenSala({ sala }) {
  const portadas = portadasDeSala(sala?.codigo3d)
  const [indice, setIndice] = useState(0)
  const [sinImagen, setSinImagen] = useState(portadas.length === 0)

  if (sinImagen || !portadas[indice]) {
    return (
      <div className="modal__imagen modal__imagen--vacia" role="img" aria-label={`Portada de ${sala?.nombre || 'la sala'}`}>
        <span>{sala?.nombre}</span>
      </div>
    )
  }

  return (
    <img
      className="modal__imagen"
      src={portadas[indice]}
      alt=""
      onError={() => {
        if (indice + 1 < portadas.length) setIndice(indice + 1)
        else setSinImagen(true)
      }}
    />
  )
}
export default function ModalSala({ sala, onCerrar }) {
  const cerrarRef = useRef(null)

  const [exhibiciones, setExhibiciones] = useState([])
  const [cargando, setCargando] = useState(false)
  const [errorCarga, setErrorCarga] = useState(null)
  const [seleccionada, setSeleccionada] = useState(null)
  const [intento, setIntento] = useState(0)

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
  }, [sala, intento])

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

        <ImagenSala key={sala.codigo3d || sala.id} sala={sala} />

        <div className="modal__cuerpo">
          <span className="modal__nombre">
            {sala.codigo3d ? sala.codigo3d.replace('_', ' ') : 'Sala'}
          </span>
          <h3 className="modal__titulo" id="modal-titulo">
            {sala.nombre}
          </h3>
          <p className="modal__descripcion">{sala.descripcion}</p>

          {seleccionada ? (
            <div className="modal-exhibicion">
              <FichaVisitante
                exhibicion={{
                  ...seleccionada,
                  salaNombre: sala.nombre,
                }}
                onCerrar={() => setSeleccionada(null)}
                modo="modal"
              />
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
                Selecciona una exhibición para conocer su detalle.
              </p>

              {cargando && (
                <p className="modal-exhibiciones__estado" role="status">
                  Cargando exhibiciones…
                </p>
              )}

              {!cargando && errorCarga && (
                <>
                  <p className="modal-exhibiciones__estado modal-exhibiciones__estado--error" role="alert">
                    {errorCarga}
                  </p>
                  <button
                    type="button"
                    className="modal__accion"
                    onClick={() => setIntento((n) => n + 1)}
                  >
                    Reintentar
                  </button>
                </>
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
                        {ex.imagenUrl ? (
                          <img
                            className="modal-exhibicion__thumb"
                            src={urlMedia(ex.imagenUrl)}
                            alt=""
                          />
                        ) : (
                          <span className="modal-exhibicion__thumb modal-exhibicion__thumb--vacia">
                            Sin imagen
                          </span>
                        )}
                        <span className="modal-exhibicion__info">
                          <span className="modal-exhibicion__nombre">{ex.titulo}</span>
                          {ex.descripcionCorta && (
                            <span className="modal-exhibicion__corta">{ex.descripcionCorta}</span>
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
