import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  obtenerExhibicion,
  editarExhibicion,
  cambiarEstadoExhibicion,
  subirImagen,
  subirVideo,
  eliminarVideo,
  historialExhibicion,
  urlMedia,
} from '../data/exhibicionesApi'
import { listarSalasPublicas } from '../data/exhibicionesPublicasApi'
import { ErrorHttp } from '../data/httpClient'
import {
  valorReal,
  etiquetaSala,
  primeraVista,
  verMas,
} from '../data/fichaExhibicion'
import { IconoAdvertencia, IconoCheck, IconoCerrar } from './iconos'
import './PaginaEdicionExhibicion.css'

const MAX_DESCRIPCION_CORTA = 200
const MAX_IMAGEN_MB = 5
const MAX_VIDEO_MB = 50

function mensajeDeError(error, porDefecto) {
  if (error instanceof ErrorHttp) {
    if (error.tipo === 'conexion') return 'No pudimos conectar con el servidor.'
    return error.message || porDefecto
  }
  return error?.message || porDefecto
}

function formatearFecha(iso) {
  if (!iso) return ''
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return ''
  const dos = (n) => String(n).padStart(2, '0')
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()} `
    + `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`
}

// ---------------------------------------------------------------------------
// Vista previa de la ficha del recorrido 3D (se actualiza mientras se escribe).
// ---------------------------------------------------------------------------
function VistaPreviaFicha({ exhibicion }) {
  const [verTodo, setVerTodo] = useState(false)
  const vista = primeraVista(exhibicion)
  const mas = verMas(exhibicion)
  const imagen = exhibicion?.imagenUrl ? urlMedia(exhibicion.imagenUrl) : null
  const video = exhibicion?.videoUrl ? urlMedia(exhibicion.videoUrl) : null

  return (
    <div className="ficha-preview">
      <p className="ficha-preview__titulo-seccion">Vista previa de la ficha</p>
      <div className="ficha-preview__tarjeta">
        {imagen ? (
          <img className="ficha-preview__imagen" src={imagen} alt={vista?.titulo || ''} />
        ) : (
          <div className="ficha-preview__imagen ficha-preview__imagen--vacia">Falta imagen</div>
        )}
        <div className="ficha-preview__cuerpo">
          <h4 className="ficha-preview__titulo">{vista?.titulo || 'Sin nombre'}</h4>
          {vista?.procedencia && (
            <p className="ficha-preview__procedencia">{vista.procedencia}</p>
          )}
          <p className="ficha-preview__sala">{vista?.sala || '—'}</p>
          {vista?.descripcionCorta && (
            <p className="ficha-preview__corta">{vista.descripcionCorta}</p>
          )}

          {(verTodo || video) && verTodo && (
            <dl className="ficha-preview__mas">
              {mas.map((campo) => (
                <div key={campo.etiqueta} className="ficha-preview__campo">
                  <dt>{campo.etiqueta}</dt>
                  <dd>{campo.valor}</dd>
                </div>
              ))}
            </dl>
          )}

          {verTodo && video && (
            <video className="ficha-preview__video" src={video} controls preload="metadata" />
          )}

          {mas.length > 0 && (
            <button
              type="button"
              className="ficha-preview__vermas"
              onClick={() => setVerTodo((v) => !v)}
            >
              {verTodo ? 'Ver menos' : 'Ver más'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página de edición
// ---------------------------------------------------------------------------
export default function PaginaEdicionExhibicion({ exhibicionId, onVolver }) {
  const [exhibicion, setExhibicion] = useState(null)
  const [salas, setSalas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)

  // Formulario de contenido.
  const [form, setForm] = useState({
    titulo: '',
    descripcionCorta: '',
    descripcion: '',
    periodo: '',
    material: '',
    culturaProcedencia: '',
    datoCurioso: '',
  })
  const [version, setVersion] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)
  const [errores, setErrores] = useState({})
  const [sucio, setSucio] = useState(false)
  const [avisoExito, setAvisoExito] = useState(null)

  // Multimedia.
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [subiendoVideo, setSubiendoVideo] = useState(false)
  const [errorMedia, setErrorMedia] = useState(null)
  const [confirmarEliminarVideo, setConfirmarEliminarVideo] = useState(false)
  const inputImagenRef = useRef(null)
  const inputVideoRef = useRef(null)

  // Estado (activar/desactivar).
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [confirmarEstado, setConfirmarEstado] = useState(null)

  // Historial.
  const [historial, setHistorial] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  const cargarHistorial = useCallback(async (id) => {
    setCargandoHistorial(true)
    try {
      const items = await historialExhibicion(id)
      setHistorial(Array.isArray(items) ? items : [])
    } catch {
      setHistorial([])
    } finally {
      setCargandoHistorial(false)
    }
  }, [])

  const aplicar = useCallback((dto) => {
    setExhibicion(dto)
    setVersion(Number(dto.version ?? 0))
    setForm({
      titulo: dto.titulo ?? '',
      descripcionCorta: dto.descripcionCorta ?? '',
      descripcion: dto.descripcion ?? '',
      periodo: dto.periodo ?? '',
      material: dto.material ?? '',
      culturaProcedencia: dto.autorCultura ?? '',
      datoCurioso: dto.datoCurioso ?? '',
    })
    setSucio(false)
    setErrores({})
    setErrorForm(null)
  }, [])

  useEffect(() => {
    const controlador = new AbortController()
    setCargando(true)
    setErrorCarga(null)
    Promise.all([
      obtenerExhibicion(exhibicionId, { signal: controlador.signal }),
      listarSalasPublicas({ signal: controlador.signal }).catch(() => []),
    ])
      .then(([dto, listaSalas]) => {
        if (controlador.signal.aborted) return
        aplicar(dto)
        setSalas(Array.isArray(listaSalas) ? listaSalas : [])
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return
        setErrorCarga(mensajeDeError(error, 'No se pudo cargar la exhibición.'))
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCargando(false)
      })
    return () => controlador.abort()
  }, [exhibicionId, aplicar])

  useEffect(() => {
    if (exhibicion?.id) cargarHistorial(exhibicion.id)
  }, [exhibicion?.id, cargarHistorial])

  // Aviso al salir con cambios sin guardar.
  useEffect(() => {
    if (!sucio) return undefined
    const alSalir = (evento) => {
      evento.preventDefault()
      evento.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', alSalir)
    return () => window.removeEventListener('beforeunload', alSalir)
  }, [sucio])

  const volver = () => {
    if (sucio && !window.confirm('Tienes cambios sin guardar. ¿Salir de todos modos?')) {
      return
    }
    onVolver?.()
  }

  const cambiarCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    setErrores((prev) => ({ ...prev, [campo]: undefined }))
    setSucio(true)
  }

  const guardar = async (evento) => {
    evento.preventDefault()
    if (guardando) return

    const nuevosErrores = {}
    if (!form.titulo.trim()) nuevosErrores.titulo = 'El nombre es obligatorio'
    if (!form.descripcionCorta.trim()) {
      nuevosErrores.descripcionCorta = 'La descripción corta es obligatoria'
    }
    if (form.descripcionCorta.length > MAX_DESCRIPCION_CORTA) {
      nuevosErrores.descripcionCorta = `Máximo ${MAX_DESCRIPCION_CORTA} caracteres`
    }
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores)
      return
    }

    setGuardando(true)
    setErrorForm(null)
    try {
      const actualizada = await editarExhibicion(exhibicionId, {
        titulo: form.titulo.trim(),
        descripcionCorta: form.descripcionCorta.trim(),
        descripcion: form.descripcion.trim() || null,
        periodo: form.periodo.trim() || null,
        material: form.material.trim() || null,
        culturaProcedencia: form.culturaProcedencia.trim() || null,
        datoCurioso: form.datoCurioso.trim() || null,
        version,
      })
      aplicar(actualizada)
      setAvisoExito('Cambios guardados correctamente.')
      cargarHistorial(exhibicionId)
      setTimeout(() => setAvisoExito(null), 3800)
    } catch (error) {
      if (error instanceof ErrorHttp && error.estado === 409) {
        setErrorForm(error.message || 'Otro administrador modificó esta exhibición; recarga.')
      } else if (error instanceof ErrorHttp && error.erroresValidacion) {
        setErrores(error.erroresValidacion)
      } else {
        setErrorForm(mensajeDeError(error, 'No se pudo guardar la edición.'))
      }
    } finally {
      setGuardando(false)
    }
  }

  // ---------- Multimedia ----------

  const subir = async (tipo, archivo) => {
    if (!archivo) return
    setErrorMedia(null)
    const esImagen = tipo === 'imagen'
    const limite = (esImagen ? MAX_IMAGEN_MB : MAX_VIDEO_MB) * 1024 * 1024
    if (archivo.size > limite) {
      setErrorMedia(`El archivo supera ${esImagen ? MAX_IMAGEN_MB : MAX_VIDEO_MB} MB.`)
      return
    }

    if (esImagen) setSubiendoImagen(true)
    else setSubiendoVideo(true)
    try {
      const actualizada = esImagen
        ? await subirImagen(exhibicionId, archivo)
        : await subirVideo(exhibicionId, archivo)
      aplicar(actualizada)
      setAvisoExito(esImagen ? 'Imagen actualizada.' : 'Video actualizado.')
      cargarHistorial(exhibicionId)
      setTimeout(() => setAvisoExito(null), 3800)
    } catch (error) {
      setErrorMedia(mensajeDeError(error, 'No se pudo subir el archivo.'))
    } finally {
      if (esImagen) setSubiendoImagen(false)
      else setSubiendoVideo(false)
      if (inputImagenRef.current) inputImagenRef.current.value = ''
      if (inputVideoRef.current) inputVideoRef.current.value = ''
    }
  }

  const borrarVideo = async () => {
    setConfirmarEliminarVideo(false)
    setErrorMedia(null)
    setSubiendoVideo(true)
    try {
      await eliminarVideo(exhibicionId)
      const actualizada = await obtenerExhibicion(exhibicionId)
      aplicar({ ...actualizada, version })
      setAvisoExito('Video eliminado.')
      cargarHistorial(exhibicionId)
      setTimeout(() => setAvisoExito(null), 3800)
    } catch (error) {
      setErrorMedia(mensajeDeError(error, 'No se pudo eliminar el video.'))
    } finally {
      setSubiendoVideo(false)
    }
  }

  // ---------- Estado ----------

  const confirmarCambioEstado = async () => {
    const nuevoEstado = confirmarEstado
    if (nuevoEstado == null) return
    setCambiandoEstado(true)
    try {
      const actualizada = await cambiarEstadoExhibicion(exhibicionId, nuevoEstado)
      aplicar(actualizada)
      setAvisoExito(actualizada.activa ? 'Exhibición activada.' : 'Exhibición desactivada.')
      cargarHistorial(exhibicionId)
      setTimeout(() => setAvisoExito(null), 3800)
    } catch (error) {
      setErrorForm(mensajeDeError(error, 'No se pudo cambiar el estado.'))
    } finally {
      setCambiandoEstado(false)
      setConfirmarEstado(null)
    }
  }

  const tieneImagen = Boolean(exhibicion?.tieneImagen || exhibicion?.imagenUrl)
  const salaTexto = etiquetaSala(exhibicion)
  const imagenUrl = exhibicion?.imagenUrl ? urlMedia(exhibicion.imagenUrl) : null
  const videoUrl = exhibicion?.videoUrl ? urlMedia(exhibicion.videoUrl) : null

  const exhibicionPreview = useMemo(() => ({
    ...exhibicion,
    titulo: form.titulo,
    descripcionCorta: form.descripcionCorta,
    descripcion: form.descripcion,
    periodo: form.periodo,
    material: form.material,
    autorCultura: form.culturaProcedencia,
    datoCurioso: form.datoCurioso,
  }), [exhibicion, form])

  if (cargando) {
    return (
      <div className="edicion-exh">
        <p className="edicion-exh__estado" role="status">Cargando exhibición…</p>
      </div>
    )
  }

  if (errorCarga || !exhibicion) {
    return (
      <div className="edicion-exh">
        <button type="button" className="edicion-exh__volver" onClick={() => onVolver?.()}>
          ← Volver al listado
        </button>
        <div className="edicion-exh__error" role="alert">
          <IconoAdvertencia />
          <span>{errorCarga || 'No se encontró la exhibición.'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="edicion-exh">
      {/* Encabezado */}
      <header className="edicion-exh__cabecera">
        <button type="button" className="edicion-exh__volver" onClick={volver}>
          ← Volver al listado
        </button>
        <div className="edicion-exh__cabecera-textos">
          <h1 className="edicion-exh__titulo">{exhibicion.titulo}</h1>
          <span className={`edicion-exh__estado-pill ${exhibicion.activa ? 'is-activa' : 'is-inactiva'}`}>
            {exhibicion.activa ? 'Activa' : 'Inactiva'}
          </span>
        </div>
        <div className="edicion-exh__cabecera-acciones">
          {exhibicion.activa ? (
            <button
              type="button"
              className="edicion-exh__btn edicion-exh__btn--peligro"
              onClick={() => setConfirmarEstado(false)}
              disabled={cambiandoEstado}
            >
              Desactivar
            </button>
          ) : (
            <button
              type="button"
              className="edicion-exh__btn edicion-exh__btn--ok"
              onClick={() => setConfirmarEstado(true)}
              disabled={cambiandoEstado || !tieneImagen}
              title={!tieneImagen ? 'Sube una imagen antes de activar la exhibición' : undefined}
            >
              Activar
            </button>
          )}
          {!exhibicion.activa && !tieneImagen && (
            <span className="edicion-exh__aviso-inline">Sube una imagen para poder activarla.</span>
          )}
        </div>
      </header>

      {avisoExito && (
        <div className="edicion-exh__toast" role="status" aria-live="polite">
          <IconoCheck /> {avisoExito}
        </div>
      )}

      {/* Identificación (solo lectura) */}
      <section className="edicion-exh__seccion">
        <h2 className="edicion-exh__seccion-titulo">Identificación</h2>
        <dl className="edicion-exh__solo-lectura">
          <div><dt>Código</dt><dd>{exhibicion.codigo}</dd></div>
          <div><dt>Sala</dt><dd>{salaTexto || '—'}</dd></div>
          <div><dt>Categoría</dt><dd>{exhibicion.categoria || '—'}</dd></div>
          <div><dt>Ubicación 3D</dt><dd>{exhibicion.ubicacion3dCodigo || '—'}</dd></div>
        </dl>
      </section>

      {/* Información */}
      <section className="edicion-exh__seccion">
        <h2 className="edicion-exh__seccion-titulo">Información</h2>
        <form className="edicion-exh__form" onSubmit={guardar} noValidate>
          <label className="edicion-exh__campo">
            <span>Nombre *</span>
            <input
              type="text"
              maxLength={200}
              value={form.titulo}
              onChange={(e) => cambiarCampo('titulo', e.target.value)}
              aria-invalid={Boolean(errores.titulo)}
            />
            {errores.titulo && <em className="edicion-exh__campo-error">{errores.titulo}</em>}
          </label>

          <label className="edicion-exh__campo">
            <span>Descripción corta *</span>
            <input
              type="text"
              maxLength={MAX_DESCRIPCION_CORTA}
              value={form.descripcionCorta}
              onChange={(e) => cambiarCampo('descripcionCorta', e.target.value)}
              aria-invalid={Boolean(errores.descripcionCorta)}
            />
            <span className={`edicion-exh__contador ${form.descripcionCorta.length > MAX_DESCRIPCION_CORTA ? 'is-error' : ''}`}>
              {form.descripcionCorta.length}/{MAX_DESCRIPCION_CORTA}
            </span>
            {errores.descripcionCorta && (
              <em className="edicion-exh__campo-error">{errores.descripcionCorta}</em>
            )}
          </label>

          <label className="edicion-exh__campo">
            <span>Descripción completa</span>
            <textarea rows={5} value={form.descripcion} onChange={(e) => cambiarCampo('descripcion', e.target.value)} />
          </label>

          <div className="edicion-exh__fila">
            <label className="edicion-exh__campo">
              <span>Época</span>
              <input type="text" maxLength={150} value={form.periodo} onChange={(e) => cambiarCampo('periodo', e.target.value)} />
            </label>
            <label className="edicion-exh__campo">
              <span>Materiales</span>
              <input type="text" maxLength={200} value={form.material} onChange={(e) => cambiarCampo('material', e.target.value)} />
            </label>
          </div>

          <label className="edicion-exh__campo">
            <span>Cultura o procedencia</span>
            <input type="text" maxLength={200} value={form.culturaProcedencia} onChange={(e) => cambiarCampo('culturaProcedencia', e.target.value)} />
          </label>

          <label className="edicion-exh__campo">
            <span>Dato curioso</span>
            <textarea rows={3} value={form.datoCurioso} onChange={(e) => cambiarCampo('datoCurioso', e.target.value)} />
          </label>

          {errorForm && (
            <p className="edicion-exh__error" role="alert">{errorForm}</p>
          )}

          <div className="edicion-exh__acciones-form">
            <button type="submit" className="edicion-exh__btn edicion-exh__btn--primario" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </section>

      {/* Multimedia */}
      <section className="edicion-exh__seccion">
        <h2 className="edicion-exh__seccion-titulo">Multimedia</h2>
        {errorMedia && <p className="edicion-exh__error" role="alert">{errorMedia}</p>}

        <div className="edicion-exh__media">
          <div className="edicion-exh__media-bloque">
            <h3>Imagen <span className="edicion-exh__req">(obligatoria para activar)</span></h3>
            {imagenUrl ? (
              <img className="edicion-exh__media-preview" src={imagenUrl} alt={exhibicion.titulo} />
            ) : (
              <div className="edicion-exh__media-preview edicion-exh__media-preview--vacia">Falta imagen</div>
            )}
            <input
              ref={inputImagenRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => subir('imagen', e.target.files?.[0])}
            />
            <button
              type="button"
              className="edicion-exh__btn"
              onClick={() => inputImagenRef.current?.click()}
              disabled={subiendoImagen}
            >
              {subiendoImagen ? 'Subiendo…' : imagenUrl ? 'Reemplazar imagen' : 'Subir imagen'}
            </button>
            <p className="edicion-exh__nota">JPG, PNG o WEBP · máx. {MAX_IMAGEN_MB} MB. La imagen no se elimina, solo se reemplaza.</p>
          </div>

          <div className="edicion-exh__media-bloque">
            <h3>Video <span className="edicion-exh__opcional">(opcional)</span></h3>
            {videoUrl ? (
              <video className="edicion-exh__media-preview" src={videoUrl} controls preload="metadata" />
            ) : (
              <div className="edicion-exh__media-preview edicion-exh__media-preview--vacia">Sin video</div>
            )}
            <input
              ref={inputVideoRef}
              type="file"
              accept="video/mp4,video/webm"
              hidden
              onChange={(e) => subir('video', e.target.files?.[0])}
            />
            <div className="edicion-exh__media-acciones">
              <button
                type="button"
                className="edicion-exh__btn"
                onClick={() => inputVideoRef.current?.click()}
                disabled={subiendoVideo}
              >
                {subiendoVideo ? 'Subiendo…' : videoUrl ? 'Reemplazar video' : 'Subir video'}
              </button>
              {videoUrl && (
                <button
                  type="button"
                  className="edicion-exh__btn edicion-exh__btn--peligro"
                  onClick={() => setConfirmarEliminarVideo(true)}
                  disabled={subiendoVideo}
                >
                  Eliminar video
                </button>
              )}
            </div>
            <p className="edicion-exh__nota">MP4 o WEBM · máx. {MAX_VIDEO_MB} MB.</p>
          </div>
        </div>
      </section>

      {/* Vista previa de la ficha */}
      <section className="edicion-exh__seccion">
        <VistaPreviaFicha exhibicion={exhibicionPreview} />
      </section>

      {/* Historial */}
      <section className="edicion-exh__seccion">
        <h2 className="edicion-exh__seccion-titulo">Historial</h2>
        {cargandoHistorial && <p className="edicion-exh__estado">Cargando historial…</p>}
        {!cargandoHistorial && historial.length === 0 && (
          <p className="edicion-exh__estado">Todavía no hay cambios registrados.</p>
        )}
        {!cargandoHistorial && historial.length > 0 && (
          <ul className="edicion-exh__historial">
            {historial.map((item, i) => (
              <li key={`${item.tipo}-${i}`} className="edicion-exh__historial-item">
                <div className="edicion-exh__historial-cab">
                  <span className={`edicion-exh__historial-tipo is-${String(item.tipo).toLowerCase()}`}>
                    {item.tipo === 'ESTADO' ? 'Estado' : 'Edición'}
                  </span>
                  <span className="edicion-exh__historial-fecha">{formatearFecha(item.fecha)}</span>
                </div>
                <p className="edicion-exh__historial-detalle">
                  {item.tipo === 'ESTADO'
                    ? `activa: ${item.valorAnterior} → ${item.valorNuevo}`
                    : `${item.campo}: ${item.valorAnterior ?? '(vacío)'} → ${item.valorNuevo ?? '(vacío)'}`}
                </p>
                <span className="edicion-exh__historial-usuario">
                  {item.usuario ? `Por ${item.usuario}` : 'Usuario desconocido'}
                  {item.motivo ? ` · ${item.motivo}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Confirmación de estado */}
      {confirmarEstado != null && (
        <div className="edicion-exh__modal" role="dialog" aria-modal="true">
          <div className="edicion-exh__modal-telon" onClick={() => setConfirmarEstado(null)} aria-hidden="true" />
          <div className="edicion-exh__modal-dialogo">
            <button type="button" className="edicion-exh__modal-cerrar" onClick={() => setConfirmarEstado(null)} aria-label="Cerrar">
              <IconoCerrar />
            </button>
            <h2>{confirmarEstado ? '¿Activar la exhibición?' : '¿Desactivar la exhibición?'}</h2>
            <p>
              {confirmarEstado
                ? 'La exhibición volverá a verse en el sitio y en el recorrido 3D.'
                : 'La exhibición dejará de verse en el sitio y en el recorrido 3D. Sus visitas y sensores se conservan.'}
            </p>
            <div className="edicion-exh__modal-acciones">
              <button type="button" className="edicion-exh__btn" onClick={() => setConfirmarEstado(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className={`edicion-exh__btn ${confirmarEstado ? 'edicion-exh__btn--ok' : 'edicion-exh__btn--peligro'}`}
                onClick={confirmarCambioEstado}
              >
                {confirmarEstado ? 'Confirmar y activar' : 'Confirmar y desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de eliminación de video */}
      {confirmarEliminarVideo && (
        <div className="edicion-exh__modal" role="dialog" aria-modal="true">
          <div className="edicion-exh__modal-telon" onClick={() => setConfirmarEliminarVideo(false)} aria-hidden="true" />
          <div className="edicion-exh__modal-dialogo">
            <h2>¿Eliminar el video?</h2>
            <p>El video se eliminará de forma permanente. La imagen no se ve afectada.</p>
            <div className="edicion-exh__modal-acciones">
              <button type="button" className="edicion-exh__btn" onClick={() => setConfirmarEliminarVideo(false)}>
                Cancelar
              </button>
              <button type="button" className="edicion-exh__btn edicion-exh__btn--peligro" onClick={borrarVideo}>
                Eliminar video
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
