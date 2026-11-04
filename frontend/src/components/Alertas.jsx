import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  IconoCampana,
  IconoAdvertencia,
  IconoCheck,
  IconoOjo,
  IconoCruz,
  IconoReloj,
} from './iconos'
import { listarAlertas, resolverAlerta } from '../data/alertasApi'
import { ErrorHttp } from '../data/httpClient'
import Paginacion from './Paginacion'
import './Alertas.css'

// ------------------------------------------------------------------
// Mapeo del DTO real (AlertaResponse) al formato que ya usa la tabla
// y el panel de detalle. El backend maneja enums en inglés:
//   tipo      ∈ {AMBIENTAL, PRESENCIA, SISTEMA, INTEGRACION}
//   severidad ∈ {INFO, ADVERTENCIA, CRITICA}
//   estado    ∈ {ABIERTA, RECONOCIDA, RESUELTA, CERRADA}
// La interfaz usa etiquetas en español. `tipo` (clase de estilo/icono)
// se deriva de la severidad/estado; el estado de ciclo de vida se
// conserva aparte. No se inventan campos que el backend no envía.
// ------------------------------------------------------------------

const ESTADOS_ACTIVOS = new Set(['ABIERTA', 'RECONOCIDA'])

function formatearFecha(iso) {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function etiquetaSeveridad(sev) {
  if (sev === 'CRITICA') return 'Crítica'
  if (sev === 'ADVERTENCIA') return 'Advertencia'
  if (sev === 'INFO') return 'Info'
  return sev || '—'
}

function etiquetaEstado(estado) {
  if (estado === 'ABIERTA') return 'Abierta'
  if (estado === 'RECONOCIDA') return 'Reconocida'
  if (estado === 'RESUELTA') return 'Resuelta'
  if (estado === 'CERRADA') return 'Cerrada'
  return estado || '—'
}

function etiquetaTipo(tipo) {
  if (tipo === 'AMBIENTAL') return 'Ambiental'
  if (tipo === 'PRESENCIA') return 'Presencia'
  if (tipo === 'SISTEMA') return 'Sistema'
  if (tipo === 'INTEGRACION') return 'Integración'
  return tipo || '—'
}

// Clase visual del icono/badge: resuelta si ya no está activa; si no,
// según la severidad.
function estiloVisual(dto) {
  if (!ESTADOS_ACTIVOS.has(dto.estado)) return 'resuelta'
  if (dto.severidad === 'CRITICA') return 'critica'
  if (dto.severidad === 'ADVERTENCIA') return 'advertencia'
  return 'advertencia'
}

function mapearAlerta(dto) {
  return {
    id: dto.id,
    estilo: estiloVisual(dto),
    fechaHora: formatearFecha(dto.iniciadaEn),
    resueltaEnTexto: dto.resueltaEn ? formatearFecha(dto.resueltaEn) : null,
    titulo: dto.descripcion ?? dto.condicionClave ?? 'Alerta',
    mensaje: dto.descripcion ?? '',
    sensor: dto.sensorCodigo ?? '—',
    sensorCodigo: dto.sensorCodigo ?? null,
    tipo: etiquetaTipo(dto.tipo),
    tipoBackend: dto.tipo ?? '',
    severidad: etiquetaSeveridad(dto.severidad),
    severidadBackend: dto.severidad ?? '',
    estado: etiquetaEstado(dto.estado),
    estadoBackend: dto.estado ?? '',
    activa: ESTADOS_ACTIVOS.has(dto.estado),
    condicionClave: dto.condicionClave ?? '',
    descripcion: dto.descripcion ?? '',
  }
}

function mensajeDeError(error, porDefecto) {
  if (error instanceof ErrorHttp) {
    if (error.tipo === 'conexion') {
      return 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.'
    }
    if (error.tipo === 'autorizacion') {
      return 'Tu sesión ha expirado o no tienes permisos para ver las alertas.'
    }
    return error.message || porDefecto
  }
  return porDefecto
}

export default function Alertas() {
  const [alertas, setAlertas] = useState([])
  const [alertaSeleccionadaId, setAlertaSeleccionadaId] = useState(null)
  const [drawerAbierto, setDrawerAbierto] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth > 1024 : true,
  )

  // Estado de la consulta real al backend.
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const [aviso, setAviso] = useState(null)

  // Resolución de alertas en curso.
  const [resolviendoIds, setResolviendoIds] = useState(() => new Set())
  const resolviendoRef = useRef(false)

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [filtroSensor, setFiltroSensor] = useState('Todos')

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1)
  const elementosPorPagina = 10

  // Carga del histórico real (incluye resueltas para el contador).
  const cargarAlertas = useCallback(async (signal) => {
    setCargando(true)
    setErrorCarga(null)
    try {
      const datos = await listarAlertas({ todas: true, signal })
      setAlertas((datos || []).map(mapearAlerta))
    } catch (error) {
      if (error?.name === 'AbortError') return
      setErrorCarga(mensajeDeError(error, 'No se pudieron cargar las alertas.'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    const controlador = new AbortController()
    cargarAlertas(controlador.signal)
    return () => controlador.abort()
  }, [cargarAlertas])

  // Contadores dinámicos calculados a partir de los datos reales.
  const cuentaCriticas = useMemo(
    () => alertas.filter((a) => a.severidadBackend === 'CRITICA' && a.activa).length,
    [alertas],
  )
  const cuentaAdvertencias = useMemo(
    () => alertas.filter((a) => a.severidadBackend === 'ADVERTENCIA' && a.activa).length,
    [alertas],
  )
  const cuentaResueltas = useMemo(
    () => alertas.filter((a) => a.estadoBackend === 'RESUELTA').length,
    [alertas],
  )

  // Opciones de sensor derivadas de los datos reales cargados.
  const opcionesSensor = useMemo(() => {
    const codigos = new Set(alertas.map((a) => a.sensorCodigo).filter(Boolean))
    return Array.from(codigos).sort()
  }, [alertas])

  // Filtrado de alertas (estado de ciclo de vida, tipo y sensor).
  const alertasFiltradas = useMemo(() => {
    return alertas.filter((item) => {
      if (filtroEstado !== 'Todos' && item.estadoBackend !== filtroEstado) return false
      if (filtroTipo !== 'Todos' && item.tipoBackend !== filtroTipo) return false
      if (filtroSensor !== 'Todos' && item.sensorCodigo !== filtroSensor) return false
      return true
    })
  }, [alertas, filtroEstado, filtroTipo, filtroSensor])

  const totalPaginas = Math.ceil(alertasFiltradas.length / elementosPorPagina) || 1
  const indiceInicio = (paginaActual - 1) * elementosPorPagina
  const alertasPaginadas = alertasFiltradas.slice(
    indiceInicio,
    indiceInicio + elementosPorPagina,
  )

  const alertaActual = useMemo(
    () => alertas.find((a) => a.id === alertaSeleccionadaId) || alertasFiltradas[0] || null,
    [alertas, alertaSeleccionadaId, alertasFiltradas],
  )

  const seleccionarAlerta = (alerta) => {
    setAlertaSeleccionadaId(alerta.id)
    setDrawerAbierto(true)
  }

  // Acción: resolver alerta en el backend.
  const marcarComoResuelta = async (id) => {
    if (resolviendoRef.current || resolviendoIds.has(id)) return
    resolviendoRef.current = true
    setResolviendoIds((prev) => new Set(prev).add(id))
    setAviso(null)
    try {
      const actualizada = await resolverAlerta(id)
      // La respuesta del backend es la fuente de verdad.
      setAlertas((lista) =>
        lista.map((a) => (a.id === id ? { ...a, ...mapearAlerta(actualizada) } : a)),
      )
      setAviso({ tipo: 'exito', texto: 'La alerta se marcó como resuelta.' })
    } catch (error) {
      setAviso({
        tipo: 'error',
        texto: mensajeDeError(error, 'No se pudo resolver la alerta. Inténtalo de nuevo.'),
      })
    } finally {
      setResolviendoIds((prev) => {
        const copia = new Set(prev)
        copia.delete(id)
        return copia
      })
      resolviendoRef.current = false
      setTimeout(() => setAviso(null), 4000)
    }
  }

  return (
    <div className="alertas-vista">
      {/* ===================== Cabecera de Página ===================== */}
      <header className="alertas-cabecera">
        <h1 className="alertas-cabecera__titulo">Alertas</h1>
        <p className="alertas-cabecera__subtitulo">
          Gestiona y da seguimiento a las alertas generadas por los sensores IoT del museo.
        </p>
      </header>

      {/* ===================== 3 Tarjetas de Resumen ===================== */}
      <section className="alertas-stats" aria-label="Resumen de alertas">
        {/* Críticas */}
        <article className="alerta-stat-card">
          <div className="alerta-stat__icono alerta-stat__icono--critica">
            <span>!</span>
          </div>
          <div className="alerta-stat__cuerpo">
            <span className="alerta-stat__valor">{cuentaCriticas}</span>
            <span className="alerta-stat__etiqueta">Alertas críticas</span>
            <span className="alerta-stat__detalle texto-rojo">Requieren atención inmediata</span>
          </div>
          <svg className="alerta-stat__sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M0,32 Q25,35 45,22 T80,24 T100,12 L100,40 L0,40 Z" fill="rgba(231, 111, 81, 0.15)" />
            <path d="M0,32 Q25,35 45,22 T80,24 T100,12" fill="none" stroke="#e76f51" strokeWidth="2" />
          </svg>
        </article>

        {/* Advertencia */}
        <article className="alerta-stat-card">
          <div className="alerta-stat__icono alerta-stat__icono--advertencia">
            <IconoAdvertencia />
          </div>
          <div className="alerta-stat__cuerpo">
            <span className="alerta-stat__valor">{cuentaAdvertencias}</span>
            <span className="alerta-stat__etiqueta">Alertas de advertencia</span>
            <span className="alerta-stat__detalle texto-naranja">Requieren revisión</span>
          </div>
          <svg className="alerta-stat__sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M0,28 Q30,15 50,28 T85,18 T100,22 L100,40 L0,40 Z" fill="rgba(229, 168, 66, 0.15)" />
            <path d="M0,28 Q30,15 50,28 T85,18 T100,22" fill="none" stroke="#e5a842" strokeWidth="2" />
          </svg>
        </article>

        {/* Resueltas */}
        <article className="alerta-stat-card">
          <div className="alerta-stat__icono alerta-stat__icono--resuelta">
            <IconoCheck />
          </div>
          <div className="alerta-stat__cuerpo">
            <span className="alerta-stat__valor">{cuentaResueltas}</span>
            <span className="alerta-stat__etiqueta">Alertas resueltas</span>
            <span className="alerta-stat__detalle texto-verde">Sin acción pendiente</span>
          </div>
          <svg className="alerta-stat__sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M0,35 Q20,38 35,28 T70,18 T100,8 L100,40 L0,40 Z" fill="rgba(42, 157, 143, 0.15)" />
            <path d="M0,35 Q20,38 35,28 T70,18 T100,8" fill="none" stroke="#2a9d8f" strokeWidth="2" />
          </svg>
        </article>
      </section>

      {/* ===================== Aviso de resultado ===================== */}
      {aviso && (
        <div
          className={`alertas-aviso alertas-aviso--${aviso.tipo}`}
          role={aviso.tipo === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {aviso.tipo === 'error' ? <IconoAdvertencia /> : <IconoCheck />}
          <span>{aviso.texto}</span>
        </div>
      )}

      {/* ===================== Barra de Filtros ===================== */}
      <section className="alertas-filtros-bar">
        <label className="alertas-filtro-item">
          <span className="alertas-filtro-label">
            <IconoReloj /> Estado
          </span>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="Todos">Todos</option>
            <option value="ABIERTA">Abierta</option>
            <option value="RECONOCIDA">Reconocida</option>
            <option value="RESUELTA">Resuelta</option>
            <option value="CERRADA">Cerrada</option>
          </select>
        </label>

        <label className="alertas-filtro-item">
          <span className="alertas-filtro-label">
            <IconoAdvertencia /> Tipo de alerta
          </span>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="Todos">Todos</option>
            <option value="AMBIENTAL">Ambiental</option>
            <option value="PRESENCIA">Presencia</option>
            <option value="SISTEMA">Sistema</option>
            <option value="INTEGRACION">Integración</option>
          </select>
        </label>

        <label className="alertas-filtro-item">
          <span className="alertas-filtro-label">
            <IconoCampana /> Sensor
          </span>
          <select value={filtroSensor} onChange={(e) => setFiltroSensor(e.target.value)}>
            <option value="Todos">Todos</option>
            {opcionesSensor.map((codigo) => (
              <option key={codigo} value={codigo}>
                {codigo}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* ===================== Layout Principal (Tabla + Detalle) ===================== */}
      <div className={`alertas-layout${drawerAbierto ? ' alertas-layout--con-drawer' : ''}`}>
        {/* Tabla de Historial */}
        <article className="alertas-tabla-card">
          <header className="alertas-tabla-cabecera">
            <span className="alertas-icono-cabecera">
              <IconoCampana />
            </span>
            <h2 className="alertas-tabla-titulo">Historial de alertas</h2>
          </header>

          {cargando && (
            <div className="alertas-estado" role="status" aria-live="polite">
              <p className="alertas-estado__texto">Cargando alertas…</p>
            </div>
          )}

          {!cargando && errorCarga && (
            <div className="alertas-estado alertas-estado--error" role="alert">
              <span className="alertas-estado__icono" aria-hidden="true">
                <IconoAdvertencia />
              </span>
              <p className="alertas-estado__texto">{errorCarga}</p>
              <button type="button" className="alertas-estado__boton" onClick={() => cargarAlertas()}>
                Reintentar
              </button>
            </div>
          )}

          {!cargando && !errorCarga && alertasFiltradas.length === 0 && (
            <div className="alertas-estado" role="status">
              <p className="alertas-estado__texto">
                {alertas.length === 0
                  ? 'No hay alertas registradas.'
                  : 'Ninguna alerta coincide con los filtros aplicados.'}
              </p>
            </div>
          )}

          {!cargando && !errorCarga && alertasFiltradas.length > 0 && (
          <div className="alertas-tabla-contenedor">
            <table className="alertas-tabla">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Severidad</th>
                  <th>Mensaje</th>
                  <th>Sensor</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {alertasPaginadas.map((item) => {
                  const activa = alertaActual?.id === item.id
                  return (
                    <tr
                      key={item.id}
                      className={activa ? 'fila--activa' : ''}
                      onClick={() => seleccionarAlerta(item)}
                    >
                      <td data-label="Fecha y hora">{item.fechaHora}</td>
                      <td data-label="Severidad">
                        <span className={`alerta-tipo-icono alerta-tipo-icono--${item.estilo}`}>
                          {item.estilo === 'critica' && '!'}
                          {item.estilo === 'advertencia' && <IconoAdvertencia />}
                          {item.estilo === 'resuelta' && <IconoCheck />}
                        </span>
                      </td>
                      <td data-label="Mensaje" className="col-mensaje">{item.mensaje}</td>
                      <td data-label="Sensor"><code>{item.sensor}</code></td>
                      <td data-label="Tipo">{item.tipo}</td>
                      <td data-label="Estado">
                        <span className={`alerta-estado-badge alerta-estado-badge--${item.estilo}`}>
                          ● {item.estado}
                        </span>
                      </td>
                      <td data-label="Acciones">
                        <button
                          type="button"
                          className="alerta-btn-accion"
                          aria-label="Ver detalle"
                          onClick={(e) => {
                            e.stopPropagation()
                            seleccionarAlerta(item)
                          }}
                        >
                          <IconoOjo />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          )}

          {!cargando && !errorCarga && alertasFiltradas.length > 0 && (
          <footer className="alertas-paginacion">
            <span className="alertas-paginacion__conteo">
              Mostrando {indiceInicio + 1} -{' '}
              {Math.min(indiceInicio + elementosPorPagina, alertasFiltradas.length)} de{' '}
              {alertasFiltradas.length} alertas
            </span>

            <Paginacion
              paginaActual={paginaActual}
              totalPaginas={totalPaginas}
              onCambiar={setPaginaActual}
            />

            <div className="alertas-paginacion__por-pag">
              <span>Mostrar 10 por página</span>
            </div>
          </footer>
          )}
        </article>

        {/* Panel lateral: Detalle de Alerta */}
        {drawerAbierto && alertaActual && (
          <>
          <div
            className="alerta-detalle-telon"
            aria-hidden="true"
            onClick={() => setDrawerAbierto(false)}
          />
          <aside className="alerta-detalle-panel" aria-label="Detalle de alerta">
            <header className="alerta-detalle__header">
              <div className="alerta-detalle__header-izq">
                <IconoCampana className="alerta-detalle__header-icono" />
                <h3 className="alerta-detalle__titulo">Detalle de alerta</h3>
              </div>
              <button
                type="button"
                className="alerta-detalle__btn-cerrar"
                onClick={() => setDrawerAbierto(false)}
                aria-label="Cerrar panel de detalle"
              >
                <IconoCruz />
              </button>
            </header>

            <div className="alerta-detalle__hero">
              <div className={`alerta-detalle__badge-icono alerta-detalle__badge-icono--${alertaActual.estilo}`}>
                {alertaActual.estilo === 'critica' && '!'}
                {alertaActual.estilo === 'advertencia' && <IconoAdvertencia />}
                {alertaActual.estilo === 'resuelta' && <IconoCheck />}
              </div>
              <div className="alerta-detalle__hero-textos">
                <div className="alerta-detalle__hero-fila">
                  <h4 className="alerta-detalle__hero-titulo">{alertaActual.titulo}</h4>
                  <span className={`alerta-badge-pill alerta-badge-pill--${alertaActual.estilo}`}>
                    {alertaActual.estado}
                  </span>
                </div>
                <span className="alerta-detalle__hero-fecha">{alertaActual.fechaHora}</span>
              </div>
            </div>

            <div className="alerta-detalle__metas">
              <div className="alerta-meta-fila">
                <span className="alerta-meta-label">Sensor</span>
                <span className="alerta-meta-valor"><code>{alertaActual.sensor}</code></span>
              </div>
              <div className="alerta-meta-fila">
                <span className="alerta-meta-label">Tipo</span>
                <span className="alerta-meta-valor">{alertaActual.tipo}</span>
              </div>
              <div className="alerta-meta-fila">
                <span className="alerta-meta-label">Severidad</span>
                <span className="alerta-meta-valor">{alertaActual.severidad}</span>
              </div>
              <div className="alerta-meta-fila">
                <span className="alerta-meta-label">Condición</span>
                <span className="alerta-meta-valor">{alertaActual.condicionClave}</span>
              </div>
              {alertaActual.resueltaEnTexto && (
                <div className="alerta-meta-fila">
                  <span className="alerta-meta-label">Resuelta en</span>
                  <span className="alerta-meta-valor">{alertaActual.resueltaEnTexto}</span>
                </div>
              )}
              <div className="alerta-meta-fila">
                <span className="alerta-meta-label">Estado</span>
                <span className={`alerta-meta-valor alerta-meta-valor--${alertaActual.estilo}`}>
                  ● {alertaActual.estado}
                </span>
              </div>
            </div>

            <div className="alerta-detalle__seccion">
              <h5 className="alerta-detalle__seccion-titulo">Descripción</h5>
              <p className="alerta-detalle__descripcion">{alertaActual.descripcion}</p>
            </div>

            <div className="alerta-detalle__footer">
              {alertaActual.activa ? (
                <button
                  type="button"
                  className="alerta-btn-resolver"
                  disabled={resolviendoIds.has(alertaActual.id)}
                  onClick={() => marcarComoResuelta(alertaActual.id)}
                >
                  <IconoCheck />
                  <span>{resolviendoIds.has(alertaActual.id) ? 'Resolviendo…' : 'Marcar como resuelta'}</span>
                </button>
              ) : (
                <div className="alerta-resuelta-aviso">
                  <IconoCheck />
                  <span>Incidencia resuelta</span>
                </div>
              )}
            </div>
          </aside>
          </>
        )}
      </div>
    </div>
  )
}
