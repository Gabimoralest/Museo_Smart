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
import { ErrorHttp } from '../data/httpClient'
import { etiquetaSala } from '../data/fichaExhibicion'
import FichaVisitante from './FichaVisitante'
import {
  IconoLapiz,
  IconoInfoCirculo,
  IconoLibro,
  IconoVideo,
  IconoAjustes,
  Icono3D,
  IconoCandado,
  IconoTemplo,
  IconoCapas,
  IconoPin,
  IconoPlay,
  IconoSubir,
  IconoBasura,
  IconoReloj,
  IconoCheck,
  IconoAdvertencia,
  IconoCerrar,
} from './iconos'
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

function formatearTamanoBytes(bytes) {
  if (!bytes || Number.isNaN(bytes)) return null
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

export default function PaginaEdicionExhibicion({ exhibicionId, onVolver }) {
  const [exhibicion, setExhibicion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)

  // Formulario de edición
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
  const [esConflicto409, setEsConflicto409] = useState(false)
  const [errores, setErrores] = useState({})
  const [sucio, setSucio] = useState(false)
  const [avisoExito, setAvisoExito] = useState(null)

  // Multimedia
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const [progresoImagen, setProgresoImagen] = useState(null)
  const [errorMediaImagen, setErrorMediaImagen] = useState(null)

  const [subiendoVideo, setSubiendoVideo] = useState(false)
  const [progresoVideo, setProgresoVideo] = useState(null)
  const [errorMediaVideo, setErrorMediaVideo] = useState(null)
  const [videoInfo, setVideoInfo] = useState(null)
  const [confirmarEliminarVideo, setConfirmarEliminarVideo] = useState(false)

  const inputImagenRef = useRef(null)
  const inputVideoRef = useRef(null)

  // Estado (activar / desactivar)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(false)

  // Historial
  const [historial, setHistorial] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)

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

  const aplicarDatosExhibicion = useCallback((dto) => {
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
    if (dto.videoUrl) {
      const nombreExtraido = dto.videoUrl.split('/').pop() || 'video.mp4'
      setVideoInfo((prev) => ({
        nombre: prev?.nombre || nombreExtraido,
        tamano: prev?.tamano || null,
      }))
    } else {
      setVideoInfo(null)
    }
    setSucio(false)
    setErrores({})
    setErrorForm(null)
    setEsConflicto409(false)
  }, [])

  const recargarExhibicion = useCallback(async () => {
    setCargando(true)
    setErrorCarga(null)
    try {
      const dto = await obtenerExhibicion(exhibicionId)
      aplicarDatosExhibicion(dto)
      cargarHistorial(exhibicionId)
    } catch (err) {
      setErrorCarga(mensajeDeError(err, 'No se pudo cargar la exhibición.'))
    } finally {
      setCargando(false)
    }
  }, [exhibicionId, aplicarDatosExhibicion, cargarHistorial])

  useEffect(() => {
    const controlador = new AbortController()
    setCargando(true)
    setErrorCarga(null)

    obtenerExhibicion(exhibicionId, { signal: controlador.signal })
      .then((dto) => {
        if (controlador.signal.aborted) return
        aplicarDatosExhibicion(dto)
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return
        setErrorCarga(mensajeDeError(error, 'No se pudo cargar la exhibición.'))
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCargando(false)
      })

    return () => controlador.abort()
  }, [exhibicionId, aplicarDatosExhibicion])

  // Advertencia al abandonar la página si hay cambios sin guardar
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
    if (sucio && !window.confirm('Tienes cambios sin guardar. ¿Deseas salir de todos modos?')) {
      return
    }
    onVolver?.()
  }

  const cambiarCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    setErrores((prev) => ({ ...prev, [campo]: undefined }))
    setSucio(true)
    setErrorForm(null)
    setEsConflicto409(false)
  }

  const abrirHistorialModal = () => {
    setMostrarHistorial(true)
    if (exhibicion?.id) {
      cargarHistorial(exhibicion.id)
    }
  }

  // Guardar cambios en el contenido textual
  const guardar = async (evento) => {
    if (evento) evento.preventDefault()
    if (guardando) return

    const nuevosErrores = {}
    if (!form.titulo.trim()) {
      nuevosErrores.titulo = 'El nombre es obligatorio'
    } else if (form.titulo.length > 200) {
      nuevosErrores.titulo = 'El nombre no puede superar 200 caracteres'
    }

    if (!form.descripcionCorta.trim()) {
      nuevosErrores.descripcionCorta = 'La descripción corta es obligatoria'
    } else if (form.descripcionCorta.length > MAX_DESCRIPCION_CORTA) {
      nuevosErrores.descripcionCorta = `La descripción corta no puede superar ${MAX_DESCRIPCION_CORTA} caracteres`
    }

    if (form.periodo && form.periodo.length > 150) {
      nuevosErrores.periodo = 'La época no puede superar 150 caracteres'
    }

    if (form.material && form.material.length > 200) {
      nuevosErrores.material = 'Los materiales no pueden superar 200 caracteres'
    }

    if (form.culturaProcedencia && form.culturaProcedencia.length > 200) {
      nuevosErrores.culturaProcedencia = 'La cultura o procedencia no puede superar 200 caracteres'
    }

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores)
      return
    }

    setGuardando(true)
    setErrorForm(null)
    setEsConflicto409(false)

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
      aplicarDatosExhibicion(actualizada)
      setAvisoExito('Cambios guardados correctamente.')
      setTimeout(() => setAvisoExito(null), 3800)
    } catch (error) {
      if (error instanceof ErrorHttp && error.estado === 409) {
        setEsConflicto409(true)
        setErrorForm(
          error.message
          || 'Otro administrador modificó esta exhibición mientras la editabas. Por favor recarga los datos para continuar.'
        )
      } else if (error instanceof ErrorHttp && error.erroresValidacion) {
        setErrores(error.erroresValidacion)
      } else {
        setErrorForm(mensajeDeError(error, 'No se pudo guardar la edición.'))
      }
    } finally {
      setGuardando(false)
    }
  }

  // Subir o reemplazar archivo multimedia
  const manejarSubida = async (tipo, archivo) => {
    if (!archivo) return
    const esImagen = tipo === 'imagen'

    if (esImagen) {
      setErrorMediaImagen(null)
      const limiteBytes = MAX_IMAGEN_MB * 1024 * 1024
      if (archivo.size > limiteBytes) {
        setErrorMediaImagen(`La imagen supera el límite de ${MAX_IMAGEN_MB} MB.`)
        return
      }
      setSubiendoImagen(true)
      setProgresoImagen(0)
    } else {
      setErrorMediaVideo(null)
      const limiteBytes = MAX_VIDEO_MB * 1024 * 1024
      if (archivo.size > limiteBytes) {
        setErrorMediaVideo(`El video supera el límite de ${MAX_VIDEO_MB} MB.`)
        return
      }
      setSubiendoVideo(true)
      setProgresoVideo(0)
      setVideoInfo({
        nombre: archivo.name,
        tamano: formatearTamanoBytes(archivo.size),
      })
    }

    try {
      const actualizada = esImagen
        ? await subirImagen(exhibicionId, archivo, {
          onProgress: (p) => setProgresoImagen(p),
        })
        : await subirVideo(exhibicionId, archivo, {
          onProgress: (p) => setProgresoVideo(p),
        })

      aplicarDatosExhibicion(actualizada)
      setAvisoExito(esImagen ? 'Imagen actualizada correctamente.' : 'Video subido correctamente.')
      setTimeout(() => setAvisoExito(null), 3800)
    } catch (error) {
      const msg = mensajeDeError(error, `No se pudo subir el archivo de ${tipo}.`)
      if (esImagen) setErrorMediaImagen(msg)
      else setErrorMediaVideo(msg)
    } finally {
      if (esImagen) {
        setSubiendoImagen(false)
        setProgresoImagen(null)
        if (inputImagenRef.current) inputImagenRef.current.value = ''
      } else {
        setSubiendoVideo(false)
        setProgresoVideo(null)
        if (inputVideoRef.current) inputVideoRef.current.value = ''
      }
    }
  }

  // Eliminar video
  const ejecutarEliminarVideo = async () => {
    setConfirmarEliminarVideo(false)
    setErrorMediaVideo(null)
    setSubiendoVideo(true)
    try {
      await eliminarVideo(exhibicionId)
      const actualizada = await obtenerExhibicion(exhibicionId)
      aplicarDatosExhibicion({ ...actualizada, version })
      setVideoInfo(null)
      setAvisoExito('Video eliminado correctamente.')
      setTimeout(() => setAvisoExito(null), 3800)
    } catch (error) {
      setErrorMediaVideo(mensajeDeError(error, 'No se pudo eliminar el video.'))
    } finally {
      setSubiendoVideo(false)
    }
  }

  // Cambiar estado activa/inactiva
  const ejecutarCambioEstado = async (nuevoEstado) => {
    setCambiandoEstado(true)
    try {
      const actualizada = await cambiarEstadoExhibicion(exhibicionId, nuevoEstado)
      aplicarDatosExhibicion(actualizada)
      setAvisoExito(actualizada.activa ? 'Exhibición visible para los visitantes.' : 'Exhibición oculta para los visitantes.')
      setTimeout(() => setAvisoExito(null), 3800)
    } catch (error) {
      setErrorForm(mensajeDeError(error, 'No se pudo cambiar el estado de la exhibición.'))
    } finally {
      setCambiandoEstado(false)
      setConfirmarDesactivar(false)
    }
  }

  const alAlternarSwitchEstado = () => {
    if (cambiandoEstado) return
    const tieneImg = Boolean(exhibicion?.tieneImagen || exhibicion?.imagenUrl)
    if (!tieneImg && !exhibicion?.activa) {
      return // Bloqueado si no tiene imagen
    }

    if (exhibicion?.activa) {
      // Confirmación obligatoria al desactivar
      setConfirmarDesactivar(true)
    } else {
      // Activar directamente
      ejecutarCambioEstado(true)
    }
  }

  // Derivaciones
  const tieneImagen = Boolean(exhibicion?.tieneImagen || exhibicion?.imagenUrl)
  const esEspecial = Boolean(
    exhibicion?.especial
    || exhibicion?.codigo === 'plaza-central-01'
    || String(exhibicion?.ubicacion3dCodigo || '').toUpperCase().includes('CENTRO')
  )
  const salaTexto = esEspecial ? 'Plaza central' : (etiquetaSala(exhibicion) || exhibicion?.salaNombre || '—')
  const categoriaTexto = esEspecial ? 'Exhibición especial' : (exhibicion?.categoria || '—')
  const imagenUrl = exhibicion?.imagenUrl ? urlMedia(exhibicion.imagenUrl) : null
  const videoUrl = exhibicion?.videoUrl ? urlMedia(exhibicion.videoUrl) : null

  // Vista previa viva: actualiza en tiempo real mientras el usuario escribe
  const exhibicionPreview = useMemo(() => ({
    ...exhibicion,
    titulo: form.titulo,
    descripcionCorta: form.descripcionCorta,
    descripcion: form.descripcion,
    periodo: form.periodo,
    material: form.material,
    autorCultura: form.culturaProcedencia,
    datoCurioso: form.datoCurioso,
    imagenUrl: exhibicion?.imagenUrl,
    videoUrl: exhibicion?.videoUrl,
  }), [exhibicion, form])

  if (cargando) {
    return (
      <div className="edicion-exh">
        <p className="edicion-exh__estado" role="status">Cargando datos de la exhibición…</p>
      </div>
    )
  }

  if (errorCarga || !exhibicion) {
    return (
      <div className="edicion-exh">
        <button type="button" className="edicion-exh__migas-btn" onClick={() => onVolver?.()}>
          ← Volver a Gestión de exhibiciones
        </button>
        <div className="edicion-exh__error-banner" role="alert">
          <IconoAdvertencia />
          <span>{errorCarga || 'No se encontró la exhibición solicitada.'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="edicion-exh">
      {/* ═══ ENCABEZADO ═══ */}
      <header className="edicion-exh__cabecera">
        {/* Migas de pan */}
        <nav className="edicion-exh__migas" aria-label="Ruta de navegación">
          <button type="button" className="edicion-exh__migas-btn" onClick={volver}>
            <span className="edicion-exh__migas-flecha">←</span>
            <span>Gestión de exhibiciones</span>
          </button>
          <span className="edicion-exh__migas-sep">/</span>
          <span className="edicion-exh__migas-actual">Editar exhibición</span>
        </nav>

        {/* Título serif con ícono de lápiz, subtítulo y botón Ver historial */}
        <div className="edicion-exh__cabecera-fila">
          <div className="edicion-exh__cabecera-info">
            <div className="edicion-exh__titulo-contenedor">
              <span className="edicion-exh__icono-lapiz-circulo" aria-hidden="true">
                <IconoLapiz />
              </span>
              <h1 className="edicion-exh__titulo">Editar exhibición</h1>
            </div>
            <p className="edicion-exh__subtitulo">
              Modifica la información y el contenido multimedia de la exhibición.
            </p>
          </div>

          <button
            type="button"
            className="edicion-exh__btn-historial"
            onClick={abrirHistorialModal}
            aria-label="Ver historial de cambios de esta exhibición"
          >
            <IconoReloj />
            <span>Ver historial</span>
          </button>
        </div>
      </header>

      {/* Toast flotante de éxito */}
      {avisoExito && (
        <div className="edicion-exh__toast-exito" role="status" aria-live="polite">
          <IconoCheck />
          <span>{avisoExito}</span>
        </div>
      )}

      {/* Alerta de conflicto 409 */}
      {esConflicto409 && (
        <div className="edicion-exh__alerta-conflicto" role="alert">
          <div className="edicion-exh__alerta-conflicto-icono">
            <IconoAdvertencia />
          </div>
          <div className="edicion-exh__alerta-conflicto-cuerpo">
            <strong>Conflicto de edición concurrente</strong>
            <p>{errorForm}</p>
          </div>
          <button
            type="button"
            className="edicion-exh__btn edicion-exh__btn--recargar"
            onClick={recargarExhibicion}
          >
            Recargar exhibición
          </button>
        </div>
      )}

      {/* Error general que no sea 409 */}
      {errorForm && !esConflicto409 && (
        <div className="edicion-exh__error-banner" role="alert">
          <IconoAdvertencia />
          <span>{errorForm}</span>
        </div>
      )}

      {/* ═══ CUERPO: DOS COLUMNAS (1 sola en < 1024px) ═══ */}
      <div className="edicion-exh__rejilla">
        {/* ─── COLUMNA IZQUIERDA ─── */}
        <div className="edicion-exh__columna">
          {/* Card: Información general */}
          <section className="edicion-exh__tarjeta">
            <div className="edicion-exh__tarjeta-cabecera">
              <span className="edicion-exh__tarjeta-icono" aria-hidden="true">
                <IconoInfoCirculo />
              </span>
              <h2 className="edicion-exh__tarjeta-titulo">Información general</h2>
            </div>

            <div className="edicion-exh__tarjeta-cuerpo">
              {/* Nombre de la exhibición * (editable) */}
              <div className="edicion-exh__campo">
                <label htmlFor="campo-titulo" className="edicion-exh__etiqueta">
                  Nombre de la exhibición <span className="edicion-exh__req">*</span>
                </label>
                <input
                  id="campo-titulo"
                  type="text"
                  maxLength={200}
                  className={`edicion-exh__input ${errores.titulo ? 'is-invalido' : ''}`}
                  value={form.titulo}
                  onChange={(e) => cambiarCampo('titulo', e.target.value)}
                  aria-invalid={Boolean(errores.titulo)}
                  placeholder="Ej. Washington cruzando el Delaware"
                />
                {errores.titulo && (
                  <span className="edicion-exh__error-msg">{errores.titulo}</span>
                )}
              </div>

              {/* Fila: Sala y Categoría (SOLO LECTURA) */}
              <div className="edicion-exh__fila-2col">
                <div className="edicion-exh__campo">
                  <span className="edicion-exh__etiqueta">Sala</span>
                  <div className="edicion-exh__solo-lectura-caja">
                    <span className="edicion-exh__solo-lectura-icono" aria-hidden="true">
                      <IconoTemplo />
                    </span>
                    <span className="edicion-exh__solo-lectura-valor">{salaTexto}</span>
                    <span className="edicion-exh__candado" title="Solo lectura">
                      <IconoCandado />
                    </span>
                  </div>
                </div>

                <div className="edicion-exh__campo">
                  <span className="edicion-exh__etiqueta">Categoría</span>
                  <div className="edicion-exh__solo-lectura-caja">
                    <span className="edicion-exh__solo-lectura-icono" aria-hidden="true">
                      <IconoCapas />
                    </span>
                    <span className="edicion-exh__solo-lectura-valor">{categoriaTexto}</span>
                    <span className="edicion-exh__candado" title="Solo lectura">
                      <IconoCandado />
                    </span>
                  </div>
                </div>
              </div>

              {/* Fila: Código y Ubicación 3D (SOLO LECTURA) */}
              <div className="edicion-exh__fila-2col">
                <div className="edicion-exh__campo">
                  <span className="edicion-exh__etiqueta">Código de exhibición</span>
                  <div className="edicion-exh__solo-lectura-caja">
                    <span className="edicion-exh__solo-lectura-valor">{exhibicion.codigo}</span>
                    <span className="edicion-exh__candado" title="Solo lectura">
                      <IconoCandado />
                    </span>
                  </div>
                </div>

                <div className="edicion-exh__campo">
                  <span className="edicion-exh__etiqueta">Ubicación 3D</span>
                  <div className="edicion-exh__solo-lectura-caja">
                    <span className="edicion-exh__solo-lectura-icono" aria-hidden="true">
                      <IconoPin />
                    </span>
                    <span className="edicion-exh__solo-lectura-valor">
                      {exhibicion.ubicacion3dCodigo || '—'}
                    </span>
                    <span className="edicion-exh__candado" title="Solo lectura">
                      <IconoCandado />
                    </span>
                  </div>
                </div>
              </div>

              {/* Fila: Época y Cultura o procedencia (editables, opcionales) */}
              <div className="edicion-exh__fila-2col">
                <div className="edicion-exh__campo">
                  <label htmlFor="campo-periodo" className="edicion-exh__etiqueta">
                    Época
                  </label>
                  <input
                    id="campo-periodo"
                    type="text"
                    maxLength={150}
                    className={`edicion-exh__input ${errores.periodo ? 'is-invalido' : ''}`}
                    value={form.periodo}
                    onChange={(e) => cambiarCampo('periodo', e.target.value)}
                    placeholder="Ej. 1851, Romanticismo"
                  />
                  {errores.periodo && (
                    <span className="edicion-exh__error-msg">{errores.periodo}</span>
                  )}
                </div>

                <div className="edicion-exh__campo">
                  <label htmlFor="campo-cultura" className="edicion-exh__etiqueta">
                    Cultura o procedencia
                  </label>
                  <input
                    id="campo-cultura"
                    type="text"
                    maxLength={200}
                    className={`edicion-exh__input ${errores.culturaProcedencia ? 'is-invalido' : ''}`}
                    value={form.culturaProcedencia}
                    onChange={(e) => cambiarCampo('culturaProcedencia', e.target.value)}
                    placeholder="Ej. Emanuel Leutze; Estados Unidos y Alemania"
                  />
                  {errores.culturaProcedencia && (
                    <span className="edicion-exh__error-msg">{errores.culturaProcedencia}</span>
                  )}
                </div>
              </div>

              {/* Descripción corta * (con contador n / 200) */}
              <div className="edicion-exh__campo">
                <label htmlFor="campo-corta" className="edicion-exh__etiqueta">
                  Descripción corta <span className="edicion-exh__req">*</span>
                </label>
                <textarea
                  id="campo-corta"
                  rows={3}
                  maxLength={MAX_DESCRIPCION_CORTA}
                  className={`edicion-exh__textarea ${errores.descripcionCorta ? 'is-invalido' : ''}`}
                  value={form.descripcionCorta}
                  onChange={(e) => cambiarCampo('descripcionCorta', e.target.value)}
                  placeholder="Breve resumen que verán los visitantes al explorar la exhibición..."
                  aria-invalid={Boolean(errores.descripcionCorta)}
                />
                <div className="edicion-exh__campo-pie">
                  {errores.descripcionCorta ? (
                    <span className="edicion-exh__error-msg">{errores.descripcionCorta}</span>
                  ) : <span />}
                  <span
                    className={`edicion-exh__contador ${
                      form.descripcionCorta.length >= MAX_DESCRIPCION_CORTA ? 'is-limite' : ''
                    }`}
                  >
                    {form.descripcionCorta.length} / {MAX_DESCRIPCION_CORTA}
                  </span>
                </div>
              </div>

              {/* Descripción completa (sin contador, sin límite en el backend) */}
              <div className="edicion-exh__campo">
                <label htmlFor="campo-completa" className="edicion-exh__etiqueta">
                  Descripción completa
                </label>
                <textarea
                  id="campo-completa"
                  rows={4}
                  className="edicion-exh__textarea"
                  value={form.descripcion}
                  onChange={(e) => cambiarCampo('descripcion', e.target.value)}
                  placeholder="Información detallada sobre la obra, su técnica, historia y simbolismo..."
                />
              </div>
            </div>
          </section>

          {/* Card: Información educativa */}
          <section className="edicion-exh__tarjeta">
            <div className="edicion-exh__tarjeta-cabecera">
              <span className="edicion-exh__tarjeta-icono" aria-hidden="true">
                <IconoLibro />
              </span>
              <h2 className="edicion-exh__tarjeta-titulo">Información educativa</h2>
            </div>

            <div className="edicion-exh__tarjeta-cuerpo">
              {/* Materiales (visible) */}
              <div className="edicion-exh__campo">
                <label htmlFor="campo-materiales" className="edicion-exh__etiqueta">
                  Materiales
                </label>
                <input
                  id="campo-materiales"
                  type="text"
                  maxLength={200}
                  className={`edicion-exh__input ${errores.material ? 'is-invalido' : ''}`}
                  value={form.material}
                  onChange={(e) => cambiarCampo('material', e.target.value)}
                  placeholder="Ej. Óleo sobre lienzo"
                />
                {errores.material && (
                  <span className="edicion-exh__error-msg">{errores.material}</span>
                )}
              </div>

              {/* Dato curioso (visible, sin pestañas) */}
              <div className="edicion-exh__campo">
                <label htmlFor="campo-curioso" className="edicion-exh__etiqueta">
                  Dato curioso
                </label>
                <textarea
                  id="campo-curioso"
                  rows={3}
                  className="edicion-exh__textarea"
                  value={form.datoCurioso}
                  onChange={(e) => cambiarCampo('datoCurioso', e.target.value)}
                  placeholder="Un dato fascinante o anécdota destacada para los visitantes..."
                />
              </div>
            </div>
          </section>
        </div>

        {/* ─── COLUMNA DERECHA ─── */}
        <div className="edicion-exh__columna">
          {/* Card: Contenido multimedia */}
          <section className="edicion-exh__tarjeta">
            <div className="edicion-exh__tarjeta-cabecera">
              <span className="edicion-exh__tarjeta-icono" aria-hidden="true">
                <IconoVideo />
              </span>
              <h2 className="edicion-exh__tarjeta-titulo">Contenido multimedia</h2>
            </div>

            <div className="edicion-exh__tarjeta-cuerpo">
              {/* Aviso: Las imágenes y el video se guardan al momento de subirlos */}
              <div className="edicion-exh__aviso-media" role="status">
                <IconoInfoCirculo />
                <span>Las imágenes y el video se guardan al momento de subirlos.</span>
              </div>

              {/* Sub-bloque Imagen */}
              <div className="edicion-exh__media-item">
                <input
                  ref={inputImagenRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => manejarSubida('imagen', e.target.files?.[0])}
                />

                {imagenUrl ? (
                  <div className="edicion-exh__imagen-marco">
                    <img
                      className="edicion-exh__imagen-vista"
                      src={imagenUrl}
                      alt={form.titulo || exhibicion.titulo}
                    />
                  </div>
                ) : (
                  <div className="edicion-exh__imagen-vacia" role="alert">
                    <span className="edicion-exh__imagen-vacia-aviso">
                      Falta imagen: súbela para poder activar la exhibición
                    </span>
                  </div>
                )}

                {/* Barra de progreso de subida de imagen */}
                {subiendoImagen && (
                  <div className="edicion-exh__barra-progreso-contenedor" role="progressbar" aria-valuenow={progresoImagen || 0}>
                    <div
                      className="edicion-exh__barra-progreso"
                      style={{ width: `${progresoImagen || 100}%` }}
                    />
                    <span className="edicion-exh__barra-progreso-texto">
                      Subiendo imagen… {progresoImagen != null ? `${progresoImagen}%` : ''}
                    </span>
                  </div>
                )}

                {/* Error de imagen */}
                {errorMediaImagen && (
                  <p className="edicion-exh__error-media" role="alert">
                    {errorMediaImagen}
                  </p>
                )}

                <div className="edicion-exh__media-acciones-fila">
                  <button
                    type="button"
                    className="edicion-exh__btn edicion-exh__btn--subir"
                    onClick={() => inputImagenRef.current?.click()}
                    disabled={subiendoImagen}
                  >
                    <IconoSubir />
                    <span>{imagenUrl ? 'Reemplazar imagen' : 'Subir imagen'}</span>
                  </button>
                  <span className="edicion-exh__ayuda-media">
                    JPG, PNG o WEBP · Máx. {MAX_IMAGEN_MB} MB
                  </span>
                </div>
              </div>

              {/* Sub-bloque Video */}
              <div className="edicion-exh__media-item edicion-exh__media-item--video">
                <input
                  ref={inputVideoRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  hidden
                  onChange={(e) => manejarSubida('video', e.target.files?.[0])}
                />

                {videoUrl ? (
                  <div className="edicion-exh__video-caja">
                    <div className="edicion-exh__video-thumb">
                      <video src={videoUrl} preload="metadata" playsInline />
                      <div className="edicion-exh__video-play-overlay" aria-hidden="true">
                        <IconoPlay />
                      </div>
                    </div>

                    <div className="edicion-exh__video-datos">
                      <span className="edicion-exh__video-nombre" title={videoInfo?.nombre || 'video.mp4'}>
                        {videoInfo?.nombre || 'video.mp4'}
                      </span>
                      {videoInfo?.tamano && (
                        <span className="edicion-exh__video-tamano">{videoInfo.tamano}</span>
                      )}
                    </div>

                    <div className="edicion-exh__video-botones">
                      <button
                        type="button"
                        className="edicion-exh__btn edicion-exh__btn--secundario"
                        onClick={() => inputVideoRef.current?.click()}
                        disabled={subiendoVideo}
                        title="Reemplazar video por otro archivo"
                      >
                        <IconoSubir />
                        <span>Reemplazar video</span>
                      </button>

                      <button
                        type="button"
                        className="edicion-exh__btn edicion-exh__btn--peligro-outline"
                        onClick={() => setConfirmarEliminarVideo(true)}
                        disabled={subiendoVideo}
                        title="Eliminar este video"
                      >
                        <IconoBasura />
                        <span>Eliminar video</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="edicion-exh__video-vacio">
                    <div className="edicion-exh__media-acciones-fila">
                      <button
                        type="button"
                        className="edicion-exh__btn edicion-exh__btn--secundario"
                        onClick={() => inputVideoRef.current?.click()}
                        disabled={subiendoVideo}
                      >
                        <IconoSubir />
                        <span>Subir video</span>
                      </button>
                      <span className="edicion-exh__ayuda-media">
                        MP4 o WEBM · Máx. {MAX_VIDEO_MB} MB
                      </span>
                    </div>
                  </div>
                )}

                {/* Barra de progreso de subida de video */}
                {subiendoVideo && (
                  <div className="edicion-exh__barra-progreso-contenedor" role="progressbar" aria-valuenow={progresoVideo || 0}>
                    <div
                      className="edicion-exh__barra-progreso"
                      style={{ width: `${progresoVideo || 100}%` }}
                    />
                    <span className="edicion-exh__barra-progreso-texto">
                      Subiendo video… {progresoVideo != null ? `${progresoVideo}%` : ''}
                    </span>
                  </div>
                )}

                {/* Error de video */}
                {errorMediaVideo && (
                  <p className="edicion-exh__error-media" role="alert">
                    {errorMediaVideo}
                  </p>
                )}

                {videoUrl && (
                  <span className="edicion-exh__ayuda-media edicion-exh__ayuda-media--inferior">
                    MP4 o WEBM · Máx. {MAX_VIDEO_MB} MB
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Card: Configuración de la exhibición */}
          <section className="edicion-exh__tarjeta">
            <div className="edicion-exh__tarjeta-cabecera">
              <span className="edicion-exh__tarjeta-icono" aria-hidden="true">
                <IconoAjustes />
              </span>
              <h2 className="edicion-exh__tarjeta-titulo">Configuración de la exhibición</h2>
            </div>

            <div className="edicion-exh__tarjeta-cuerpo">
              <div className="edicion-exh__switch-fila">
                <span className="edicion-exh__etiqueta">Estado</span>

                <button
                  type="button"
                  role="switch"
                  aria-checked={exhibicion.activa}
                  aria-label="Estado de visibilidad de la exhibición"
                  disabled={cambiandoEstado || (!tieneImagen && !exhibicion.activa)}
                  className={`edicion-exh__switch ${exhibicion.activa ? 'is-activo' : ''} ${
                    !tieneImagen && !exhibicion.activa ? 'is-bloqueado' : ''
                  }`}
                  onClick={alAlternarSwitchEstado}
                >
                  <span className="edicion-exh__switch-puntero" />
                </button>

                <div className="edicion-exh__switch-textos">
                  <span className="edicion-exh__switch-estado">
                    {exhibicion.activa ? 'Activa' : 'Inactiva'}
                  </span>
                  <span className="edicion-exh__switch-descripcion">
                    {exhibicion.activa ? 'Visible para los visitantes' : 'Oculta para los visitantes'}
                  </span>
                </div>
              </div>

              {!tieneImagen && !exhibicion.activa && (
                <p className="edicion-exh__aviso-bloqueo" role="alert">
                  <IconoAdvertencia />
                  <span>Falta imagen: súbela para poder activar la exhibición.</span>
                </p>
              )}
            </div>
          </section>

          {/* Card: Vista previa en el recorrido 3D */}
          <section className="edicion-exh__tarjeta">
            <div className="edicion-exh__tarjeta-cabecera">
              <span className="edicion-exh__tarjeta-icono" aria-hidden="true">
                <Icono3D />
              </span>
              <h2 className="edicion-exh__tarjeta-titulo">Vista previa en el recorrido 3D</h2>
            </div>

            <div className="edicion-exh__tarjeta-cuerpo edicion-exh__tarjeta-cuerpo--previa">
              <FichaVisitante
                exhibicion={exhibicionPreview}
                modo="vista-previa"
              />
            </div>
          </section>
        </div>
      </div>

      {/* ═══ PIE DE PÁGINA: CANCELAR Y GUARDAR ═══ */}
      <footer className="edicion-exh__pie">
        <div className="edicion-exh__pie-acciones">
          <button
            type="button"
            className="edicion-exh__btn edicion-exh__btn--cancelar"
            onClick={volver}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="edicion-exh__btn edicion-exh__btn--guardar"
            onClick={guardar}
            disabled={guardando}
          >
            <IconoCheck />
            <span>{guardando ? 'Guardando…' : 'Guardar cambios'}</span>
          </button>
        </div>
      </footer>

      {/* ═══ MODAL HISTORIAL ═══ */}
      {mostrarHistorial && (
        <div className="edicion-exh__modal" role="dialog" aria-modal="true" aria-labelledby="modal-historial-titulo">
          <div className="edicion-exh__modal-telon" onClick={() => setMostrarHistorial(false)} aria-hidden="true" />
          <div className="edicion-exh__modal-dialogo edicion-exh__modal-dialogo--ancho">
            <div className="edicion-exh__modal-cabecera">
              <h2 id="modal-historial-titulo">Historial de cambios</h2>
              <button
                type="button"
                className="edicion-exh__modal-cerrar"
                onClick={() => setMostrarHistorial(false)}
                aria-label="Cerrar modal de historial"
              >
                <IconoCerrar />
              </button>
            </div>

            <div className="edicion-exh__modal-cuerpo">
              {cargandoHistorial && <p className="edicion-exh__estado">Cargando historial…</p>}
              {!cargandoHistorial && historial.length === 0 && (
                <p className="edicion-exh__estado">Todavía no hay cambios registrados en esta exhibición.</p>
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
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL CONFIRMAR DESACTIVACIÓN ═══ */}
      {confirmarDesactivar && (
        <div className="edicion-exh__modal" role="dialog" aria-modal="true" aria-labelledby="modal-desactivar-titulo">
          <div className="edicion-exh__modal-telon" onClick={() => setConfirmarDesactivar(false)} aria-hidden="true" />
          <div className="edicion-exh__modal-dialogo">
            <h2 id="modal-desactivar-titulo">¿Desactivar la exhibición?</h2>
            <p>
              La exhibición dejará de verse en el sitio web y en el recorrido 3D.
              Sus visitas, sensores y configuración se conservan intactos.
            </p>
            <div className="edicion-exh__modal-acciones">
              <button
                type="button"
                className="edicion-exh__btn edicion-exh__btn--cancelar"
                onClick={() => setConfirmarDesactivar(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="edicion-exh__btn edicion-exh__btn--peligro"
                onClick={() => ejecutarCambioEstado(false)}
              >
                Confirmar y desactivar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL CONFIRMAR ELIMINACIÓN DE VIDEO ═══ */}
      {confirmarEliminarVideo && (
        <div className="edicion-exh__modal" role="dialog" aria-modal="true" aria-labelledby="modal-eliminar-video-titulo">
          <div className="edicion-exh__modal-telon" onClick={() => setConfirmarEliminarVideo(false)} aria-hidden="true" />
          <div className="edicion-exh__modal-dialogo">
            <h2 id="modal-eliminar-video-titulo">¿Eliminar el video?</h2>
            <p>El video se eliminará de forma permanente de los servidores. La imagen no se verá afectada.</p>
            <div className="edicion-exh__modal-acciones">
              <button
                type="button"
                className="edicion-exh__btn edicion-exh__btn--cancelar"
                onClick={() => setConfirmarEliminarVideo(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="edicion-exh__btn edicion-exh__btn--peligro"
                onClick={ejecutarEliminarVideo}
              >
                Eliminar video
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
