import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  IconoTemplo,
  IconoColeccion,
  IconoBuscar,
  IconoEtiqueta,
  IconoOrdenar,
  IconoChevron,
  IconoCerrar,
  IconoAdvertencia,
  IconoEditar,
} from './iconos'
import { OPCIONES_ESTADO, OPCIONES_ORDEN } from '../data/exhibicionesData'
import { listarExhibiciones, urlMedia } from '../data/exhibicionesApi'
import { listarSalasPublicas } from '../data/exhibicionesPublicasApi'
import { ErrorHttp } from '../data/httpClient'
import './GestionExhibiciones.css'

// ---------------------------------------------------------------------------
// Traducción del DTO real (ExhibicionAdminResponse).
// ---------------------------------------------------------------------------
function mapearExhibicion(dto) {
  const salaId = dto.salaId != null ? Number(dto.salaId) : null
  // La categoría viene derivada del backend; la especial no tiene sala.
  const categoria = dto.categoria ?? (dto.especial ? 'Exhibición especial' : '')
  return {
    id: Number(dto.id),
    nombre: dto.titulo ?? '',
    codigo: dto.codigo ?? '',
    descripcionCorta: dto.descripcionCorta ?? '',
    categoria,
    salaId,
    sala: dto.especial ? 'Exhibición especial' : (dto.salaNombre ?? ''),
    especial: Boolean(dto.especial),
    activa: Boolean(dto.activa),
    tieneImagen: Boolean(dto.tieneImagen || dto.imagenUrl),
    imagenUrl: dto.imagenUrl ? urlMedia(dto.imagenUrl) : null,
    videoUrl: dto.videoUrl ? urlMedia(dto.videoUrl) : null,
    version: dto.version ?? 0,
  }
}

function mensajeDeError(error, porDefecto) {
  if (error instanceof ErrorHttp) {
    if (error.tipo === 'conexion') {
      return 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.'
    }
    if (error.tipo === 'autorizacion') {
      return 'Tu sesión ha expirado o no tienes permisos para esta acción. Inicia sesión de nuevo.'
    }
    return error.message || porDefecto
  }
  return porDefecto
}

// Marcador neutro cuando la exhibición no tiene imagen.
function MarcadorImagen() {
  return (
    <div className="tarjeta-exh__marcador" role="img" aria-label="Falta imagen">
      <span className="tarjeta-exh__marcador-texto">Falta imagen</span>
    </div>
  )
}

export default function GestionExhibiciones({
  busqueda: busquedaProp,
  onCambiarBusqueda,
  onEditar,
}) {
  const [exhibiciones, setExhibiciones] = useState([])
  const [salas, setSalas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)

  // Filtros
  const [busquedaLocal, setBusquedaLocal] = useState('')
  const busqueda = busquedaProp !== undefined ? busquedaProp : busquedaLocal
  const setBusqueda = onCambiarBusqueda || setBusquedaLocal

  const [salaFiltro, setSalaFiltro] = useState('todas')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [soloSinImagen, setSoloSinImagen] = useState(false)
  const [orden, setOrden] = useState('nombre-asc')

  const [menuAbierto, setMenuAbierto] = useState(null)
  const contenedorRef = useRef(null)

  useEffect(() => {
    const alClicFuera = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setMenuAbierto(null)
      }
    }
    document.addEventListener('pointerdown', alClicFuera)
    return () => document.removeEventListener('pointerdown', alClicFuera)
  }, [])

  const cargar = useCallback(async (signal) => {
    setCargando(true)
    setErrorCarga(null)
    try {
      const datos = await listarExhibiciones({ signal })
      setExhibiciones((datos || []).map(mapearExhibicion))
    } catch (error) {
      if (error?.name === 'AbortError') return
      setErrorCarga(mensajeDeError(error, 'No se pudieron cargar las exhibiciones.'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    const controlador = new AbortController()
    cargar(controlador.signal)
    listarSalasPublicas({ signal: controlador.signal })
      .then((datos) => {
        if (controlador.signal.aborted) return
        setSalas((Array.isArray(datos) ? datos : []).slice().sort(
          (a, b) => (a.orden ?? a.id) - (b.orden ?? b.id),
        ))
      })
      .catch(() => {})
    return () => controlador.abort()
  }, [cargar])

  useEffect(() => {
    const alPresionarTecla = (e) => {
      if (e.key === 'Escape') setMenuAbierto(null)
    }
    window.addEventListener('keydown', alPresionarTecla)
    return () => window.removeEventListener('keydown', alPresionarTecla)
  }, [])

  const contadores = useMemo(() => {
    const total = exhibiciones.length
    const activas = exhibiciones.filter((i) => i.activa).length
    return {
      total,
      activas,
      inactivas: total - activas,
      salas: new Set(exhibiciones.filter((i) => !i.especial).map((i) => i.salaId)).size,
    }
  }, [exhibiciones])

  // Opciones del filtro: "Todas", 6 salas reales, "Exhibición especial".
  const opcionesSala = useMemo(() => {
    const base = [{ valor: 'todas', etiqueta: 'Todas las salas' }]
    for (const s of salas) {
      base.push({
        valor: String(s.id),
        etiqueta: s.codigo3d ? `${s.codigo3d} · ${s.nombre}` : `Sala ${s.id}`,
      })
    }
    base.push({ valor: 'especial', etiqueta: 'Exhibición especial' })
    return base
  }, [salas])

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return exhibiciones
      .filter((item) => {
        if (termino) {
          const coincide = item.nombre.toLowerCase().includes(termino)
            || item.descripcionCorta.toLowerCase().includes(termino)
            || item.categoria.toLowerCase().includes(termino)
          if (!coincide) return false
        }
        if (salaFiltro === 'especial') {
          if (!item.especial) return false
        } else if (salaFiltro !== 'todas') {
          if (String(item.salaId) !== String(salaFiltro)) return false
        }
        if (estadoFiltro === 'activas' && !item.activa) return false
        if (estadoFiltro === 'inactivas' && item.activa) return false
        if (soloSinImagen && item.tieneImagen) return false
        return true
      })
      .sort((a, b) => {
        switch (orden) {
          case 'nombre-desc':
            return b.nombre.localeCompare(a.nombre, 'es', { sensitivity: 'base' })
          case 'sala-asc': {
            const sa = a.especial ? 99 : a.salaId
            const sb = b.especial ? 99 : b.salaId
            return sa - sb || a.nombre.localeCompare(b.nombre, 'es')
          }
          case 'estado-activas':
            return (b.activa === a.activa ? 0 : b.activa ? 1 : -1) || a.nombre.localeCompare(b.nombre, 'es')
          case 'estado-inactivas':
            return (a.activa === b.activa ? 0 : a.activa ? 1 : -1) || a.nombre.localeCompare(b.nombre, 'es')
          default:
            return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
        }
      })
  }, [exhibiciones, busqueda, salaFiltro, estadoFiltro, soloSinImagen, orden])

  const limpiarFiltros = () => {
    setBusqueda('')
    setSalaFiltro('todas')
    setEstadoFiltro('todos')
    setSoloSinImagen(false)
    setOrden('nombre-asc')
  }

  const editar = (item) => {
    if (onEditar) onEditar(item.id)
    else window.location.hash = `#/admin/exhibiciones/${item.id}/editar`
  }

  const etiquetaSalaActual =
    opcionesSala.find((o) => o.valor === salaFiltro)?.etiqueta || 'Todas las salas'
  const etiquetaEstadoActual =
    OPCIONES_ESTADO.find((o) => o.valor === estadoFiltro)?.etiqueta || 'Todos los estados'
  const etiquetaOrdenActual =
    OPCIONES_ORDEN.find((o) => o.valor === orden)?.etiqueta || 'Nombre (A - Z)'

  return (
    <div className="gestion-exh" ref={contenedorRef}>
      <header className="gestion-exh__cabecera">
        <h1 className="gestion-exh__titulo">Gestión de exhibiciones</h1>
        <p className="gestion-exh__subtitulo">
          Edita el contenido y el multimedia de cada exhibición del museo.
        </p>
      </header>

      <section className="gestion-exh__resumen" aria-label="Métricas de exhibiciones">
        <article className="stat-card">
          <div className="stat-card__icono-contenedor stat-card__icono-contenedor--dorado" aria-hidden="true">
            <IconoTemplo className="stat-card__icono" />
          </div>
          <div className="stat-card__info">
            <span className="stat-card__valor">{contadores.total}</span>
            <span className="stat-card__etiqueta">Total de exhibiciones</span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-card__icono-contenedor stat-card__icono-contenedor--verde" aria-hidden="true">
            <span className="stat-card__punto stat-card__punto--verde" />
          </div>
          <div className="stat-card__info">
            <span className="stat-card__valor">{contadores.activas}</span>
            <span className="stat-card__etiqueta">Activas</span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-card__icono-contenedor stat-card__icono-contenedor--rojo" aria-hidden="true">
            <span className="stat-card__punto stat-card__punto--rojo" />
          </div>
          <div className="stat-card__info">
            <span className="stat-card__valor">{contadores.inactivas}</span>
            <span className="stat-card__etiqueta">Inactivas</span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-card__icono-contenedor stat-card__icono-contenedor--dorado" aria-hidden="true">
            <IconoColeccion className="stat-card__icono" />
          </div>
          <div className="stat-card__info">
            <span className="stat-card__valor">{contadores.salas}</span>
            <span className="stat-card__etiqueta">Salas</span>
          </div>
        </article>
      </section>

      <section className="gestion-exh__controles" aria-label="Filtros y ordenamiento">
        <div className="filtro-buscar">
          <span className="filtro-buscar__icono" aria-hidden="true"><IconoBuscar /></span>
          <input
            id="filtro-busqueda-input"
            type="search"
            className="filtro-buscar__input"
            placeholder="Buscar por nombre, categoría o descripción..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar exhibiciones"
          />
          {busqueda && (
            <button type="button" className="filtro-buscar__limpiar" onClick={() => setBusqueda('')} aria-label="Borrar búsqueda">
              <IconoCerrar />
            </button>
          )}
        </div>

        <div className="gestion-exh__filtros-grupo">
          <div className="menu-desplegable">
            <button
              type="button"
              className={`menu-desplegable__boton${salaFiltro !== 'todas' ? ' menu-desplegable__boton--activo' : ''}`}
              onClick={() => setMenuAbierto((prev) => (prev === 'sala' ? null : 'sala'))}
              aria-haspopup="listbox"
              aria-expanded={menuAbierto === 'sala'}
            >
              <IconoTemplo className="menu-desplegable__icono" />
              <span className="menu-desplegable__texto">{etiquetaSalaActual}</span>
              <IconoChevron className="menu-desplegable__chevron" />
            </button>
            {menuAbierto === 'sala' && (
              <div className="menu-desplegable__lista" role="listbox" aria-label="Filtrar por sala">
                {opcionesSala.map((opcion) => (
                  <button
                    key={opcion.valor}
                    type="button"
                    role="option"
                    aria-selected={salaFiltro === opcion.valor}
                    className={`menu-desplegable__item${salaFiltro === opcion.valor ? ' menu-desplegable__item--seleccionado' : ''}`}
                    onClick={() => { setSalaFiltro(opcion.valor); setMenuAbierto(null) }}
                  >
                    {opcion.etiqueta}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="menu-desplegable">
            <button
              type="button"
              className={`menu-desplegable__boton${estadoFiltro !== 'todos' ? ' menu-desplegable__boton--activo' : ''}`}
              onClick={() => setMenuAbierto((prev) => (prev === 'estado' ? null : 'estado'))}
              aria-haspopup="listbox"
              aria-expanded={menuAbierto === 'estado'}
            >
              <IconoEtiqueta className="menu-desplegable__icono" />
              <span className="menu-desplegable__texto">{etiquetaEstadoActual}</span>
              <IconoChevron className="menu-desplegable__chevron" />
            </button>
            {menuAbierto === 'estado' && (
              <div className="menu-desplegable__lista" role="listbox" aria-label="Filtrar por estado">
                {OPCIONES_ESTADO.map((opcion) => (
                  <button
                    key={opcion.valor}
                    type="button"
                    role="option"
                    aria-selected={estadoFiltro === opcion.valor}
                    className={`menu-desplegable__item${estadoFiltro === opcion.valor ? ' menu-desplegable__item--seleccionado' : ''}`}
                    onClick={() => { setEstadoFiltro(opcion.valor); setMenuAbierto(null) }}
                  >
                    {opcion.etiqueta}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className={`gestion-exh__filtro-rapido${soloSinImagen ? ' is-activo' : ''}`}
            aria-pressed={soloSinImagen}
            onClick={() => setSoloSinImagen((v) => !v)}
          >
            Sin imagen
          </button>

          <div className="menu-desplegable menu-desplegable--orden">
            <button
              type="button"
              className="menu-desplegable__boton"
              onClick={() => setMenuAbierto((prev) => (prev === 'orden' ? null : 'orden'))}
              aria-haspopup="listbox"
              aria-expanded={menuAbierto === 'orden'}
            >
              <IconoOrdenar className="menu-desplegable__icono" />
              <span className="menu-desplegable__texto-orden">
                <span className="menu-desplegable__prefijo">Ordenar por</span>
                <span className="menu-desplegable__valor-orden">{etiquetaOrdenActual}</span>
              </span>
              <IconoChevron className="menu-desplegable__chevron" />
            </button>
            {menuAbierto === 'orden' && (
              <div className="menu-desplegable__lista menu-desplegable__lista--derecha" role="listbox" aria-label="Ordenar exhibiciones">
                {OPCIONES_ORDEN.map((opcion) => (
                  <button
                    key={opcion.valor}
                    type="button"
                    role="option"
                    aria-selected={orden === opcion.valor}
                    className={`menu-desplegable__item${orden === opcion.valor ? ' menu-desplegable__item--seleccionado' : ''}`}
                    onClick={() => { setOrden(opcion.valor); setMenuAbierto(null) }}
                  >
                    {opcion.etiqueta}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {errorCarga && !cargando && (
        <div className="gestion-exh__vacio gestion-exh__vacio--error" role="alert">
          <div className="gestion-exh__vacio-icono" aria-hidden="true"><IconoAdvertencia /></div>
          <h2 className="gestion-exh__vacio-titulo">No se pudieron cargar las exhibiciones</h2>
          <p className="gestion-exh__vacio-texto">{errorCarga}</p>
          <button type="button" className="gestion-exh__vacio-boton" onClick={() => cargar()}>
            Reintentar
          </button>
        </div>
      )}

      {cargando && (
        <div className="gestion-exh__vacio" role="status" aria-live="polite">
          <div className="gestion-exh__vacio-icono" aria-hidden="true"><IconoColeccion /></div>
          <p className="gestion-exh__vacio-texto">Cargando exhibiciones…</p>
        </div>
      )}

      {!cargando && !errorCarga && filtradas.length > 0 && (
        <section className="gestion-exh__cuadricula" aria-label="Lista de exhibiciones">
          {filtradas.map((item) => (
            <article className="tarjeta-exh" key={item.id} id={`exhibicion-${item.id}`}>
              <div className="tarjeta-exh__imagen-contenedor">
                {item.imagenUrl ? (
                  <img src={item.imagenUrl} alt={item.nombre} className="tarjeta-exh__imagen" loading="lazy" />
                ) : (
                  <MarcadorImagen />
                )}
                <span className={`tarjeta-exh__badge ${item.activa ? 'tarjeta-exh__badge--activa' : 'tarjeta-exh__badge--inactiva'}`}>
                  <span className="tarjeta-exh__badge-punto" aria-hidden="true" />
                  {item.activa ? 'Activa' : 'Inactiva'}
                </span>
                {!item.tieneImagen && (
                  <span className="tarjeta-exh__badge-imagen">Falta imagen</span>
                )}
              </div>

              <div className="tarjeta-exh__cuerpo">
                <h2 className="tarjeta-exh__nombre">{item.nombre}</h2>
                <p className="tarjeta-exh__subtitulo">
                  {item.especial ? 'Exhibición especial' : (item.sala || item.categoria)}
                </p>
                {item.descripcionCorta && (
                  <p className="tarjeta-exh__descripcion">{item.descripcionCorta}</p>
                )}

                <div className="tarjeta-exh__acciones">
                  <button type="button" className="boton-exh boton-exh--editar" onClick={() => editar(item)}>
                    <IconoEditar /> Editar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {!cargando && !errorCarga && filtradas.length === 0 && (
        <div className="gestion-exh__vacio" role="status">
          <div className="gestion-exh__vacio-icono" aria-hidden="true"><IconoBuscar /></div>
          <h2 className="gestion-exh__vacio-titulo">No se encontraron exhibiciones</h2>
          <p className="gestion-exh__vacio-texto">
            No hay exhibiciones que coincidan con los filtros o el término de búsqueda.
          </p>
          <button type="button" className="gestion-exh__vacio-boton" onClick={limpiarFiltros}>
            Restablecer todos los filtros
          </button>
        </div>
      )}
    </div>
  )
}
