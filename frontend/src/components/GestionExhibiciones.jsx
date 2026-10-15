import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  IconoTemplo,
  IconoColeccion,
  IconoBuscar,
  IconoEtiqueta,
  IconoOrdenar,
  IconoChevron,
  IconoCerrar,
  IconoAdvertencia,
  IconoCheck,
} from './iconos'
import {
  OPCIONES_SALA,
  OPCIONES_ESTADO,
  OPCIONES_ORDEN,
  imagenExhibicion,
} from '../data/exhibicionesData'
import { listarExhibiciones, cambiarEstadoExhibicion } from '../data/exhibicionesApi'
import { ErrorHttp } from '../data/httpClient'
import './GestionExhibiciones.css'

// El backend no expone todavía la imagen de cada exhibición (no hay endpoint de
// contenido multimedia). Mientras eso no exista, se reutilizan los recursos
// locales ya presentes en public/images/exhibiciones, asignados de forma estable
// por identificador. NO son datos simulados de negocio: solo un recurso visual.
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

function imagenPara(exhibicion) {
  const id = Number(exhibicion.id)
  const indice = Number.isFinite(id) && id > 0
    ? (id - 1) % IMAGENES_DISPONIBLES.length
    : 0
  return imagenExhibicion(IMAGENES_DISPONIBLES[indice])
}

// Traduce el DTO real del backend (ExhibicionResponse) a la forma que ya usan
// las tarjetas existentes, sin inventar propiedades: nombre<-titulo,
// sala:'Sala N' a partir de salaId, subtitulo con el nombre real de la sala.
// Mensaje claro según el tipo de error del cliente HTTP compartido.
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

function mapearExhibicion(dto) {
  const salaId = dto.salaId != null ? Number(dto.salaId) : null
  const sala = salaId != null ? `Sala ${salaId}` : ''
  return {
    id: Number(dto.id),
    nombre: dto.titulo ?? '',
    subtitulo: dto.salaNombre ? `${sala} · ${dto.salaNombre}` : sala,
    descripcion: dto.descripcion ?? '',
    codigo: dto.codigo ?? '',
    salaId: salaId ?? 0,
    sala,
    activa: Boolean(dto.activa),
    imagen: imagenPara(dto),
  }
}

export default function GestionExhibiciones({
  busqueda: busquedaProp,
  onCambiarBusqueda,
}) {
  // Exhibiciones reales del backend.
  const [exhibiciones, setExhibiciones] = useState([])

  // Estado de la carga inicial y de errores de la API.
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)

  // Identificadores con una operación de cambio de estado en curso.
  const [guardandoIds, setGuardandoIds] = useState(() => new Set())

  // Filtros y ordenamiento
  const [busquedaLocal, setBusquedaLocal] = useState('')
  const busqueda = busquedaProp !== undefined ? busquedaProp : busquedaLocal
  const setBusqueda = onCambiarBusqueda || setBusquedaLocal

  const [salaFiltro, setSalaFiltro] = useState('todas')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [orden, setOrden] = useState('nombre-asc')

  // Menús desplegables accesibles
  const [menuAbierto, setMenuAbierto] = useState(null) // 'sala' | 'estado' | 'orden' | null
  const contenedorRef = useRef(null)

  // Estado del modal de confirmación antes de cambiar disponibilidad
  const [modalConfirmar, setModalConfirmar] = useState({
    abierto: false,
    exhibicion: null,
    nuevoEstado: false,
  })

  // Mensaje temporal de retroalimentación tras confirmar
  const [mensajeExito, setMensajeExito] = useState(null)

  // Cerrar menús al hacer clic fuera
  useEffect(() => {
    const alClicFuera = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setMenuAbierto(null)
      }
    }
    document.addEventListener('pointerdown', alClicFuera)
    return () => document.removeEventListener('pointerdown', alClicFuera)
  }, [])

  // Carga inicial (y recarga) del listado real desde el backend.
  const cargarExhibiciones = useCallback(async (signal) => {
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
    cargarExhibiciones(controlador.signal)
    return () => controlador.abort()
  }, [cargarExhibiciones])

  // Cerrar modal con Escape
  useEffect(() => {
    const alPresionarTecla = (e) => {
      if (e.key === 'Escape') {
        if (modalConfirmar.abierto) {
          setModalConfirmar({ abierto: false, exhibicion: null, nuevoEstado: false })
        }
        setMenuAbierto(null)
      }
    }
    window.addEventListener('keydown', alPresionarTecla)
    return () => window.removeEventListener('keydown', alPresionarTecla)
  }, [modalConfirmar.abierto])

  // Contadores dinámicos calculados a partir de los datos locales
  const contadores = useMemo(() => {
    const total = exhibiciones.length
    const activas = exhibiciones.filter((item) => item.activa).length
    const inactivas = total - activas
    const salasUnicas = new Set(exhibiciones.map((item) => item.sala)).size
    return { total, activas, inactivas, salas: salasUnicas }
  }, [exhibiciones])

  // Manejador del cambio de búsqueda
  const manejarCambioBusqueda = (valor) => {
    setBusqueda(valor)
  }

  // Filtrado y ordenamiento en tiempo real
  const exhibicionesFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()

    return exhibiciones
      .filter((item) => {
        // Filtro por texto en nombre y descripción
        if (termino) {
          const coincideNombre = item.nombre.toLowerCase().includes(termino)
          const coincideDesc = item.descripcion.toLowerCase().includes(termino)
          const coincideSub = item.subtitulo.toLowerCase().includes(termino)
          if (!coincideNombre && !coincideDesc && !coincideSub) {
            return false
          }
        }

        // Filtro por sala
        if (salaFiltro !== 'todas' && item.sala !== salaFiltro) {
          return false
        }

        // Filtro por estado
        if (estadoFiltro === 'activas' && !item.activa) return false
        if (estadoFiltro === 'inactivas' && item.activa) return false

        return true
      })
      .sort((a, b) => {
        switch (orden) {
          case 'nombre-asc':
            return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
          case 'nombre-desc':
            return b.nombre.localeCompare(a.nombre, 'es', { sensitivity: 'base' })
          case 'sala-asc':
            return a.salaId - b.salaId || a.nombre.localeCompare(b.nombre, 'es')
          case 'estado-activas':
            return (b.activa === a.activa ? 0 : b.activa ? 1 : -1) || a.nombre.localeCompare(b.nombre, 'es')
          case 'estado-inactivas':
            return (a.activa === b.activa ? 0 : a.activa ? 1 : -1) || a.nombre.localeCompare(b.nombre, 'es')
          default:
            return 0
        }
      })
  }, [exhibiciones, busqueda, salaFiltro, estadoFiltro, orden])

  // Iniciar flujo de confirmación antes de activar o desactivar
  const solicitarCambioDisponibilidad = (exhibicion) => {
    setModalConfirmar({
      abierto: true,
      exhibicion,
      nuevoEstado: !exhibicion.activa,
    })
  }

  // Confirmar y persistir el cambio en el backend.
  const confirmarCambioDisponibilidad = async () => {
    const { exhibicion, nuevoEstado } = modalConfirmar
    if (!exhibicion) return

    const id = exhibicion.id
    // Evita solicitudes duplicadas ante clics repetidos.
    if (guardandoIds.has(id)) return

    setGuardandoIds((prev) => new Set(prev).add(id))
    setModalConfirmar({ abierto: false, exhibicion: null, nuevoEstado: false })

    try {
      const actualizada = await cambiarEstadoExhibicion(id, nuevoEstado)
      // La respuesta del backend es la fuente de verdad.
      setExhibiciones((anteriores) =>
        anteriores.map((item) =>
          item.id === Number(actualizada.id)
            ? { ...item, ...mapearExhibicion(actualizada) }
            : item,
        ),
      )
      setMensajeExito({
        texto: `«${exhibicion.nombre}» ahora está ${actualizada.activa ? 'activa' : 'inactiva'}.`,
        tipo: actualizada.activa ? 'activa' : 'inactiva',
      })
    } catch (error) {
      // No se cambia el estado local: se conserva el valor correcto del backend.
      setMensajeExito({
        texto: mensajeDeError(error, 'No se pudo cambiar el estado. Inténtalo de nuevo.'),
        tipo: 'error',
      })
    } finally {
      setGuardandoIds((prev) => {
        const copia = new Set(prev)
        copia.delete(id)
        return copia
      })
      setTimeout(() => {
        setMensajeExito(null)
      }, 3800)
    }
  }

  const cancelarCambioDisponibilidad = () => {
    setModalConfirmar({ abierto: false, exhibicion: null, nuevoEstado: false })
  }

  const limpiarFiltros = () => {
    setBusqueda('')
    setSalaFiltro('todas')
    setEstadoFiltro('todos')
    setOrden('nombre-asc')
  }

  const etiquetaSalaActual =
    OPCIONES_SALA.find((o) => o.valor === salaFiltro)?.etiqueta || 'Todas las salas'
  const etiquetaEstadoActual =
    OPCIONES_ESTADO.find((o) => o.valor === estadoFiltro)?.etiqueta || 'Todos los estados'
  const etiquetaOrdenActual =
    OPCIONES_ORDEN.find((o) => o.valor === orden)?.etiqueta || 'Nombre (A - Z)'

  return (
    <div className="gestion-exh" ref={contenedorRef}>
      {/* Toast de confirmación de cambio */}
      {mensajeExito && (
        <div className={`gestion-exh__toast gestion-exh__toast--${mensajeExito.tipo}`} role="status" aria-live="polite">
          {mensajeExito.tipo === 'error' ? <IconoAdvertencia /> : <IconoCheck />}
          <span>{mensajeExito.texto}</span>
        </div>
      )}

      {/* ===================== Cabecera de la sección ===================== */}
      <header className="gestion-exh__cabecera">
        <h1 className="gestion-exh__titulo">Gestión de exhibiciones</h1>
        <p className="gestion-exh__subtitulo">
          Consulta y administra la disponibilidad de las exhibiciones del museo.
        </p>
      </header>

      {/* ===================== Tarjetas de resumen ===================== */}
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

      {/* ===================== Barra de filtros y orden ===================== */}
      <section className="gestion-exh__controles" aria-label="Filtros y ordenamiento">
        {/* Buscador de exhibición */}
        <div className="filtro-buscar">
          <span className="filtro-buscar__icono" aria-hidden="true">
            <IconoBuscar />
          </span>
          <input
            id="filtro-busqueda-input"
            type="search"
            className="filtro-buscar__input"
            placeholder="Buscar por nombre o descripción..."
            value={busqueda}
            onChange={(e) => manejarCambioBusqueda(e.target.value)}
            aria-label="Buscar por nombre o descripción"
          />
          {busqueda && (
            <button
              type="button"
              className="filtro-buscar__limpiar"
              onClick={() => manejarCambioBusqueda('')}
              aria-label="Borrar búsqueda"
            >
              <IconoCerrar />
            </button>
          )}
        </div>

        <div className="gestion-exh__filtros-grupo">
          {/* Dropdown Salas */}
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
                {OPCIONES_SALA.map((opcion) => (
                  <button
                    key={opcion.valor}
                    type="button"
                    role="option"
                    aria-selected={salaFiltro === opcion.valor}
                    className={`menu-desplegable__item${salaFiltro === opcion.valor ? ' menu-desplegable__item--seleccionado' : ''}`}
                    onClick={() => {
                      setSalaFiltro(opcion.valor)
                      setMenuAbierto(null)
                    }}
                  >
                    {opcion.etiqueta}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dropdown Estados */}
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
                    onClick={() => {
                      setEstadoFiltro(opcion.valor)
                      setMenuAbierto(null)
                    }}
                  >
                    {opcion.etiqueta}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dropdown Orden */}
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
                    onClick={() => {
                      setOrden(opcion.valor)
                      setMenuAbierto(null)
                    }}
                  >
                    {opcion.etiqueta}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===================== Error de carga ===================== */}
      {errorCarga && !cargando && (
        <div className="gestion-exh__vacio gestion-exh__vacio--error" role="alert">
          <div className="gestion-exh__vacio-icono" aria-hidden="true">
            <IconoAdvertencia />
          </div>
          <h2 className="gestion-exh__vacio-titulo">No se pudieron cargar las exhibiciones</h2>
          <p className="gestion-exh__vacio-texto">{errorCarga}</p>
          <button
            type="button"
            className="gestion-exh__vacio-boton"
            onClick={() => cargarExhibiciones()}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ===================== Carga inicial ===================== */}
      {cargando && (
        <div className="gestion-exh__vacio" role="status" aria-live="polite">
          <div className="gestion-exh__vacio-icono" aria-hidden="true">
            <IconoColeccion />
          </div>
          <p className="gestion-exh__vacio-texto">Cargando exhibiciones…</p>
        </div>
      )}

      {/* ===================== Cuadrícula de exhibiciones ===================== */}
      {!cargando && !errorCarga && exhibicionesFiltradas.length > 0 ? (
        <section className="gestion-exh__cuadricula" aria-label="Lista de exhibiciones">
          {exhibicionesFiltradas.map((item) => (
            <article className="tarjeta-exh" key={item.id} id={`exhibicion-${item.id}`}>
              {/* Contenedor de imagen */}
              <div className="tarjeta-exh__imagen-contenedor">
                <img
                  src={item.imagen}
                  alt={item.nombre}
                  className="tarjeta-exh__imagen"
                  loading="lazy"
                />

                {/* Badge de estado en la esquina superior derecha */}
                <span
                  className={`tarjeta-exh__badge ${
                    item.activa ? 'tarjeta-exh__badge--activa' : 'tarjeta-exh__badge--inactiva'
                  }`}
                >
                  <span className="tarjeta-exh__badge-punto" aria-hidden="true" />
                  {item.activa ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              {/* Cuerpo de la tarjeta */}
              <div className="tarjeta-exh__cuerpo">
                <h2 className="tarjeta-exh__nombre">{item.nombre}</h2>
                <p className="tarjeta-exh__subtitulo">{item.subtitulo}</p>
                <p className="tarjeta-exh__descripcion">{item.descripcion}</p>

                {/* Control de disponibilidad */}
                <div className="tarjeta-exh__disponibilidad">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.activa}
                    aria-busy={guardandoIds.has(item.id)}
                    disabled={guardandoIds.has(item.id)}
                    aria-label={`Cambiar disponibilidad de ${item.nombre}. Estado actual: ${
                      item.activa ? 'Activa' : 'Inactiva'
                    }`}
                    className={`switch-control ${item.activa ? 'switch-control--activo' : ''}`}
                    onClick={() => solicitarCambioDisponibilidad(item)}
                  >
                    <span className="switch-control__pista">
                      <span className="switch-control__manija" />
                    </span>
                  </button>

                  <div className="tarjeta-exh__disp-textos">
                    <span className="tarjeta-exh__disp-estado">
                      {item.activa ? 'Disponibilidad activa' : 'Disponibilidad inactiva'}
                    </span>
                    <span className="tarjeta-exh__disp-ayuda">
                      {item.activa
                        ? 'Visible en el recorrido virtual.'
                        : 'No visible en el recorrido virtual.'}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        !cargando &&
        !errorCarga && (
          /* Estado vacío */
          <div className="gestion-exh__vacio" role="status">
            <div className="gestion-exh__vacio-icono" aria-hidden="true">
              <IconoBuscar />
            </div>
            <h2 className="gestion-exh__vacio-titulo">No se encontraron exhibiciones</h2>
            <p className="gestion-exh__vacio-texto">
              No hay exhibiciones que coincidan con los filtros o el término de búsqueda ingresado.
            </p>
            <button type="button" className="gestion-exh__vacio-boton" onClick={limpiarFiltros}>
              Restablecer todos los filtros
            </button>
          </div>
        )
      )}

      {/* ===================== Modal de confirmación ===================== */}
      {modalConfirmar.abierto && modalConfirmar.exhibicion && (
        <div className="modal-disp" role="dialog" aria-modal="true" aria-labelledby="modal-disp-titulo">
          <div className="modal-disp__telon" onClick={cancelarCambioDisponibilidad} aria-hidden="true" />
          <div className="modal-disp__dialogo">
            <div className="modal-disp__icono-aviso" aria-hidden="true">
              <IconoAdvertencia />
            </div>

            <h2 className="modal-disp__titulo" id="modal-disp-titulo">
              {modalConfirmar.nuevoEstado
                ? '¿Activar disponibilidad de la exhibición?'
                : '¿Desactivar disponibilidad de la exhibición?'}
            </h2>

            <p className="modal-disp__descripcion">
              Estás a punto de cambiar el estado de{' '}
              <strong>«{modalConfirmar.exhibicion.nombre}»</strong> a{' '}
              <span className={modalConfirmar.nuevoEstado ? 'texto-activa' : 'texto-inactiva'}>
                {modalConfirmar.nuevoEstado ? 'Activa' : 'Inactiva'}
              </span>
              .
            </p>

            <p className="modal-disp__detalle">
              {modalConfirmar.nuevoEstado
                ? 'La exhibición volverá a ser visible para los visitantes en el recorrido virtual del museo.'
                : 'La exhibición dejará de estar visible temporalmente en el recorrido virtual para el público general.'}
            </p>

            <div className="modal-disp__nota-simulada" role="note">
              El cambio se guardará en el servidor y quedará registrado en el historial de la
              exhibición.
            </div>

            <div className="modal-disp__acciones">
              <button
                type="button"
                className="modal-disp__boton-cancelar"
                onClick={cancelarCambioDisponibilidad}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`modal-disp__boton-confirmar ${
                  modalConfirmar.nuevoEstado
                    ? 'modal-disp__boton-confirmar--activar'
                    : 'modal-disp__boton-confirmar--desactivar'
                }`}
                onClick={confirmarCambioDisponibilidad}
              >
                {modalConfirmar.nuevoEstado ? 'Confirmar y activar' : 'Confirmar y desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
