import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  IconoTermometro,
  IconoGota,
  IconoUsuarios,
  IconoWifi,
  IconoReloj,
  IconoAnalitica,
  IconoAdvertencia,
  IconoBuscar,
  IconoCheck,
} from './iconos'
import {
  listarSensores,
  listarLecturasRecientes,
  obtenerResumenMonitoreo,
  obtenerHistorico,
  obtenerSaludOutbox,
} from '../data/monitoreoApi'
import { listarAlertas } from '../data/alertasApi'
import { ErrorHttp } from '../data/httpClient'
import Paginacion from './Paginacion'
import './MonitoreoIoT.css'

// ------------------------------------------------------------------
// Datos reales: PostgreSQL (sensores, lecturas recientes, resumen) e
// InfluxDB (histórico de TEMPERATURA/HUMEDAD/LUZ vía /historico). Un sensor
// sin lecturas NO se marca como "desconectado". No se inventan puntos.
// ------------------------------------------------------------------

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
  })
}

function etiquetaEstadoSensor(estado) {
  if (estado === 'ACTIVO') return 'Activo'
  if (estado === 'INACTIVO') return 'Inactivo'
  if (estado === 'MANTENIMIENTO') return 'Mantenimiento'
  return estado || '—'
}

function valorDe(sensor, metrica) {
  const l = sensor.lecturas?.find((x) => x.metrica === metrica)
  return l || null
}

function formatearValor(lectura) {
  if (!lectura) return '—'
  const v = Number(lectura.valor)
  const unidad = lectura.unidad ? ` ${lectura.unidad}` : ''
  if (!Number.isFinite(v)) return '—'
  return `${v.toFixed(1)}${unidad}`
}

function etiquetaMetrica(metrica) {
  if (metrica === 'TEMPERATURA') return 'Temperatura'
  if (metrica === 'HUMEDAD') return 'Humedad'
  if (metrica === 'LUZ') return 'Luz'
  if (metrica === 'PRESENCIA') return 'Presencia'
  return metrica || '—'
}

function formatearPromedio(p) {
  if (!p || p.valor == null) return '—'
  const v = Number(p.valor)
  if (!Number.isFinite(v)) return '—'
  return `${v.toFixed(1)}${p.unidad ? ` ${p.unidad}` : ''}`
}

// Construye el atributo "points" de un <polyline> SVG a partir de una serie de
// puntos reales (tiempo, valor). Escala a un viewBox 0..100 x 0..100.
function construirPolyline(puntos) {
  if (!puntos || puntos.length < 2) return null
  const tiempos = puntos.map((p) => new Date(p.tiempo).getTime())
  const valores = puntos.map((p) => Number(p.valor))
  const tMin = Math.min(...tiempos)
  const tMax = Math.max(...tiempos)
  const vMin = Math.min(...valores)
  const vMax = Math.max(...valores)
  const rangoT = tMax - tMin || 1
  const rangoV = vMax - vMin || 1
  return puntos
    .map((p) => {
      const x = ((new Date(p.tiempo).getTime() - tMin) / rangoT) * 100
      const y = 100 - ((Number(p.valor) - vMin) / rangoV) * 100
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

function resumenSerie(datos) {
  if (!datos?.series) return null
  const puntos = datos.series.flatMap((s) => s.puntos)
  if (puntos.length === 0) return null
  const valores = puntos.map((p) => Number(p.valor))
  return {
    min: Math.min(...valores),
    max: Math.max(...valores),
    ultimo: valores[valores.length - 1],
    total: puntos.length,
  }
}

function mensajeDeError(error, porDefecto) {
  if (error instanceof ErrorHttp) {
    if (error.tipo === 'conexion') {
      return 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.'
    }
    if (error.tipo === 'autorizacion') {
      return 'Tu sesión ha expirado o no tienes permisos para ver el monitoreo.'
    }
    return error.message || porDefecto
  }
  return porDefecto
}

export default function MonitoreoIoT() {
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)

  const [sensores, setSensores] = useState([])
  const [lecturas, setLecturas] = useState([])
  const [resumen, setResumen] = useState(null)

  // Filtros de tabla
  const [filtroSala, setFiltroSala] = useState('Todas')
  const [filtroMetrica, setFiltroMetrica] = useState('Todas')

  // Histórico (InfluxDB): rango en horas y estado por métrica.
  const [rangoHoras, setRangoHoras] = useState(24)
  const [historico, setHistorico] = useState({}) // { TEMPERATURA: {...}, HUMEDAD: {...} }
  const [historicoEstado, setHistoricoEstado] = useState({}) // { METRICA: 'cargando'|'error'|'ok' }

  // Salud del outbox (envío de lecturas a InfluxDB).
  const [outbox, setOutbox] = useState(null)
  const [outboxEstado, setOutboxEstado] = useState('cargando') // cargando|ok|error

  // Alertas ambientales IoT (activas), reutilizando el servicio de Alertas.
  const [alertas, setAlertas] = useState([])
  const [alertasEstado, setAlertasEstado] = useState('cargando') // cargando|ok|error

  // Paginación de la tabla de lecturas
  const [paginaActual, setPaginaActual] = useState(1)
  const elementosPorPagina = 6

  const cargar = useCallback(async (signal) => {
    setCargando(true)
    setErrorCarga(null)
    const resultados = await Promise.allSettled([
      listarSensores({ signal }).then((d) => setSensores(d || [])),
      listarLecturasRecientes({ signal }).then((d) => setLecturas(d || [])),
      obtenerResumenMonitoreo({ signal }).then((d) => setResumen(d || null)),
      obtenerSaludOutbox({ signal })
        .then((d) => {
          setOutbox(d || null)
          setOutboxEstado('ok')
        })
        .catch((e) => {
          if (e?.name !== 'AbortError') setOutboxEstado('error')
        }),
      listarAlertas({ todas: false, signal })
        .then((d) => {
          setAlertas(d || [])
          setAlertasEstado('ok')
        })
        .catch((e) => {
          if (e?.name !== 'AbortError') setAlertasEstado('error')
        }),
    ])
    const fallos = resultados.filter(
      (r) => r.status === 'rejected' && r.reason?.name !== 'AbortError',
    )
    if (fallos.length > 0) {
      setErrorCarga(
        mensajeDeError(fallos[0].reason, 'No se pudo cargar la información de monitoreo.'),
      )
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    const controlador = new AbortController()
    cargar(controlador.signal)
    return () => controlador.abort()
  }, [cargar])

  // Carga del histórico de temperatura y humedad para el rango seleccionado.
  const cargarHistorico = useCallback(async (signal) => {
    const hasta = new Date()
    const desde = new Date(hasta.getTime() - rangoHoras * 60 * 60 * 1000)
    const metricas = ['TEMPERATURA', 'HUMEDAD']
    setHistoricoEstado((prev) => {
      const copia = { ...prev }
      metricas.forEach((m) => (copia[m] = 'cargando'))
      return copia
    })
    const resultados = await Promise.allSettled(
      metricas.map((metrica) =>
        obtenerHistorico({
          metrica,
          desde: desde.toISOString(),
          hasta: hasta.toISOString(),
          signal,
        }).then((d) => ({ metrica, datos: d })),
      ),
    )
    setHistorico((prev) => {
      const copia = { ...prev }
      resultados.forEach((r) => {
        if (r.status === 'fulfilled') copia[r.value.metrica] = r.value.datos
      })
      return copia
    })
    setHistoricoEstado((prev) => {
      const copia = { ...prev }
      resultados.forEach((r, i) => {
        const metrica = metricas[i]
        if (r.status === 'fulfilled') copia[metrica] = 'ok'
        else if (r.reason?.name !== 'AbortError') copia[metrica] = 'error'
      })
      return copia
    })
  }, [rangoHoras])

  useEffect(() => {
    const controlador = new AbortController()
    cargarHistorico(controlador.signal)
    return () => controlador.abort()
  }, [cargarHistorico])

  // Índice de sensores por id (para enriquecer las lecturas).
  const sensorPorId = useMemo(() => {
    const mapa = new Map()
    sensores.forEach((s) => mapa.set(s.id, s))
    return mapa
  }, [sensores])

  // Sensores ambientales agrupados por sala (para el grid de salas).
  const salas = useMemo(() => {
    const mapa = new Map()
    sensores
      .filter((s) => s.categoria === 'AMBIENTAL')
      .forEach((s) => {
        const clave = s.salaId ?? 'sin-sala'
        if (!mapa.has(clave)) {
          mapa.set(clave, {
            salaId: s.salaId,
            nombre: s.salaNombre || 'Sala sin nombre',
            sensores: [],
          })
        }
        mapa.get(clave).sensores.push(s)
      })
    return Array.from(mapa.values())
  }, [sensores])

  const promedioPorMetrica = useMemo(() => {
    const mapa = new Map()
    ;(resumen?.promediosAmbientales || []).forEach((p) => mapa.set(p.metrica, p))
    return mapa
  }, [resumen])

  const presencia = resumen?.presencia || null

  const sensoresSinLecturas = resumen?.sensoresSinLecturas ?? 0

  // Alertas ambientales activas, enriquecidas con la sala del sensor (cruce
  // con los sensores ya cargados). Solo datos reales; sin inventar severidad.
  const alertasIot = useMemo(() => {
    return alertas
      .filter(
        (a) =>
          a.tipo === 'AMBIENTAL' &&
          (a.estado === 'ABIERTA' || a.estado === 'RECONOCIDA'),
      )
      .map((a) => {
        const sensor = sensorPorId.get(a.sensorId)
        return {
          ...a,
          salaNombre: sensor?.salaNombre ?? null,
          exhibicionTitulo: sensor?.exhibicionTitulo ?? null,
          sensorCodigo: a.sensorCodigo ?? sensor?.codigo ?? null,
        }
      })
      .sort((a, b) => new Date(b.iniciadaEn || 0) - new Date(a.iniciadaEn || 0))
  }, [alertas, sensorPorId])

  // Opciones de filtro derivadas de las lecturas reales.
  const opcionesSala = useMemo(() => {
    const set = new Map()
    sensores.forEach((s) => {
      if (s.salaId != null && !set.has(s.salaId)) set.set(s.salaId, s.salaNombre)
    })
    return Array.from(set, ([id, nombre]) => ({ id, nombre }))
  }, [sensores])

  const lecturasFiltradas = useMemo(() => {
    return lecturas
      .map((l) => {
        const sensor = sensorPorId.get(l.sensorId)
        return {
          ...l,
          salaId: sensor?.salaId ?? null,
          sala: sensor?.salaNombre ?? null,
          exhibicion: sensor?.exhibicionTitulo ?? null,
          sensorCodigo: sensor?.codigo ?? `#${l.sensorId}`,
        }
      })
      .filter((l) => {
        if (filtroSala !== 'Todas' && String(l.salaId) !== filtroSala) return false
        if (filtroMetrica !== 'Todas' && l.metrica !== filtroMetrica) return false
        return true
      })
      .sort((a, b) => new Date(b.medidoEn || 0) - new Date(a.medidoEn || 0))
  }, [lecturas, sensorPorId, filtroSala, filtroMetrica])

  const totalPaginas = Math.ceil(lecturasFiltradas.length / elementosPorPagina) || 1
  const indiceInicio = (paginaActual - 1) * elementosPorPagina
  const lecturasPaginadas = lecturasFiltradas.slice(
    indiceInicio,
    indiceInicio + elementosPorPagina,
  )

  return (
    <div className="monitoreo-vista">
      {/* ===================== Cabecera de Página ===================== */}
      <header className="monitoreo-cabecera">
        <div className="monitoreo-cabecera__textos">
          <h1 className="monitoreo-cabecera__titulo">Monitoreo IoT</h1>
          <p className="monitoreo-cabecera__subtitulo">
            Últimas lecturas y estado de los sensores del museo, con datos reales de PostgreSQL.
          </p>
        </div>

        {/* Indicador discreto del envío de lecturas (outbox) */}
        <div className="monitoreo-outbox" aria-live="polite">
          {outboxEstado === 'cargando' && (
            <span className="monitoreo-outbox__texto">Comprobando envío de lecturas…</span>
          )}
          {outboxEstado === 'error' && (
            <span className="monitoreo-outbox__texto monitoreo-outbox__texto--error">
              No se pudo consultar el envío de lecturas.
            </span>
          )}
          {outboxEstado === 'ok' && outbox && (
            <>
              <span
                className={`monitoreo-outbox__punto${
                  outbox.enError > 0
                    ? ' monitoreo-outbox__punto--error'
                    : outbox.pendientes > 0
                      ? ' monitoreo-outbox__punto--aviso'
                      : ' monitoreo-outbox__punto--ok'
                }`}
                aria-hidden="true"
              />
              <span className="monitoreo-outbox__texto">
                Envío a InfluxDB: {outbox.enviadas.toLocaleString('es-CO')} enviadas
                {outbox.pendientes > 0 ? ` · ${outbox.pendientes} pendientes` : ''}
                {outbox.enError > 0 ? ` · ${outbox.enError} con error` : ''}
              </span>
            </>
          )}
        </div>
      </header>

      {/* ===================== Aviso de error ===================== */}
      {!cargando && errorCarga && (
        <div className="monitoreo-aviso monitoreo-aviso--error" role="alert">
          <IconoAdvertencia />
          <span>{errorCarga}</span>
          <button type="button" className="monitoreo-aviso__boton" onClick={() => cargar()}>
            Reintentar
          </button>
        </div>
      )}

      {/* ===================== Carga ===================== */}
      {cargando && (
        <div className="monitoreo-estado" role="status" aria-live="polite">
          <p className="monitoreo-estado__texto">Cargando monitoreo…</p>
        </div>
      )}

      {!cargando && (
      <>
      {/* ===================== 4 Tarjetas de Métricas ===================== */}
      <section className="monitoreo-stats" aria-label="Indicadores IoT">
        <article className="monitoreo-stat-card">
          <div className="monitoreo-stat__icono monitoreo-stat__icono--temp">
            <IconoTermometro />
          </div>
          <div className="monitoreo-stat__cuerpo">
            <span className="monitoreo-stat__valor">
              {formatearPromedio(promedioPorMetrica.get('TEMPERATURA'))}
            </span>
            <span className="monitoreo-stat__etiqueta">Temperatura promedio</span>
            <span className="monitoreo-stat__subnota">Últimas 24 horas</span>
          </div>
        </article>

        <article className="monitoreo-stat-card">
          <div className="monitoreo-stat__icono monitoreo-stat__icono--hum">
            <IconoGota />
          </div>
          <div className="monitoreo-stat__cuerpo">
            <span className="monitoreo-stat__valor">
              {formatearPromedio(promedioPorMetrica.get('HUMEDAD'))}
            </span>
            <span className="monitoreo-stat__etiqueta">Humedad promedio</span>
            <span className="monitoreo-stat__subnota">Últimas 24 horas</span>
          </div>
        </article>

        <article className="monitoreo-stat-card">
          <div className="monitoreo-stat__icono monitoreo-stat__icono--pres">
            <IconoUsuarios />
          </div>
          <div className="monitoreo-stat__cuerpo">
            <span className="monitoreo-stat__valor">
              {presencia ? presencia.exhibicionesConPresencia : '—'}
            </span>
            <span className="monitoreo-stat__etiqueta">Exhibiciones con presencia</span>
            <span className="monitoreo-stat__subnota">
              {presencia ? `${presencia.sensoresConDato} sensores con dato` : 'Sin datos'}
            </span>
          </div>
        </article>

        <article className="monitoreo-stat-card">
          <div className="monitoreo-stat__icono monitoreo-stat__icono--sensores">
            <IconoWifi />
          </div>
          <div className="monitoreo-stat__cuerpo">
            <span className="monitoreo-stat__valor">
              {resumen ? `${resumen.sensoresConLecturas} / ${resumen.totalSensores}` : '—'}
            </span>
            <span className="monitoreo-stat__etiqueta">Sensores con lecturas</span>
            <span className="monitoreo-stat__subnota">
              {sensoresSinLecturas > 0
                ? `${sensoresSinLecturas} sin lecturas`
                : 'Todos con lecturas'}
            </span>
          </div>
        </article>
      </section>

      {/* ===================== Estado de sensores por sala ===================== */}
      <section className="monitoreo-salas-seccion">
        <header className="monitoreo-seccion-header">
          <div className="monitoreo-seccion-header__izq">
            <span className="monitoreo-icono-titulo">
              <IconoAnalitica />
            </span>
            <h2 className="monitoreo-seccion-titulo">Estado de sensores ambientales por sala</h2>
          </div>
        </header>

        {salas.length === 0 ? (
          <div className="monitoreo-vacio" role="status">
            <IconoBuscar />
            <span>No hay sensores ambientales registrados.</span>
          </div>
        ) : (
          <div className="monitoreo-salas-grid">
            {salas.map((sala) => {
              const sensor = sala.sensores[0]
              const temp = valorDe(sensor, 'TEMPERATURA')
              const hum = valorDe(sensor, 'HUMEDAD')
              return (
                <article key={sala.salaId ?? sala.nombre} className="sala-card">
                  <div className="sala-card__cuerpo">
                    <div className="sala-card__titulo-fila">
                      <div>
                        <h3 className="sala-card__nombre">{sala.nombre}</h3>
                        <span className="sala-card__tipo">
                          {sala.sensores.length} sensor(es) ambiental(es)
                        </span>
                      </div>
                    </div>

                    <div className="sala-card__sensores-estado">
                      <span className={sensor?.tieneLecturas ? 'punto-verde' : 'punto-gris'} />
                      <span>
                        {sensor
                          ? `${etiquetaEstadoSensor(sensor.estado)} · ${
                              sensor.tieneLecturas ? 'con lecturas' : 'sin lecturas'
                            }`
                          : 'sin sensor'}
                      </span>
                    </div>

                    <div className="sala-card__lecturas-lista">
                      <div className="sala-card__lectura-item">
                        <IconoTermometro />
                        <span>{formatearValor(temp)}</span>
                      </div>
                      <div className="sala-card__lectura-item">
                        <IconoGota />
                        <span>{formatearValor(hum)}</span>
                      </div>
                      <div className="sala-card__lectura-item">
                        <IconoReloj />
                        <span>{temp ? formatearFecha(temp.medidoEn) : 'sin lecturas'}</span>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* ===================== Gráficas históricas (InfluxDB) ===================== */}
      <section className="monitoreo-graficas-grid">
        <article className="monitoreo-grafica-card monitoreo-grafica-card--ancho">
          <header className="monitoreo-grafica__header">
            <div className="monitoreo-grafica__titulo-wrap">
              <span className="monitoreo-grafica__icono monitoreo-grafica__icono--temp">
                <IconoAnalitica />
              </span>
              <div>
                <h2 className="monitoreo-grafica__titulo">Histórico de temperatura y humedad</h2>
                <span className="monitoreo-grafica__subtitulo">
                  InfluxDB · últimos {rangoHoras} h
                </span>
              </div>
            </div>
            <select
              className="monitoreo-select-wrap"
              value={rangoHoras}
              onChange={(e) => setRangoHoras(Number(e.target.value))}
              aria-label="Rango temporal del histórico"
            >
              <option value={1}>Última 1 h</option>
              <option value={6}>Últimas 6 h</option>
              <option value={24}>Últimas 24 h</option>
              <option value={168}>Últimos 7 días</option>
            </select>
          </header>

          {['TEMPERATURA', 'HUMEDAD'].map((metrica) => {
            const datos = historico[metrica]
            const estado = historicoEstado[metrica]
            const resumenSerieDato = resumenSerie(datos)
            return (
              <div key={metrica} className="monitoreo-grafica__bloque">
                <span className="monitoreo-grafica__bloque-titulo">
                  {metrica === 'TEMPERATURA' ? 'Temperatura (°C)' : 'Humedad (%)'}
                </span>
                {estado === 'cargando' && (
                  <div className="monitoreo-vacio" role="status">
                    <span>Cargando histórico…</span>
                  </div>
                )}
                {estado === 'error' && (
                  <div className="monitoreo-vacio" role="alert">
                    <IconoAdvertencia />
                    <span>No se pudo cargar el histórico.</span>
                    <button
                      type="button"
                      className="monitoreo-aviso__boton"
                      onClick={() => cargarHistorico()}
                    >
                      Reintentar
                    </button>
                  </div>
                )}
                {estado === 'ok' && !resumenSerieDato && (
                  <div className="monitoreo-vacio" role="status">
                    <IconoBuscar />
                    <span>Sin datos en el rango seleccionado.</span>
                  </div>
                )}
                {estado === 'ok' && resumenSerieDato && (
                  <div className="monitoreo-grafica__cuerpo">
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="grafica-svg"
                      role="img"
                      aria-label={`Histórico de ${metrica}`}
                    >
                      {datos.series.map((serie) => {
                        const poly = construirPolyline(serie.puntos)
                        if (!poly) return null
                        return (
                          <polyline
                            key={serie.sensor}
                            points={poly}
                            fill="none"
                            stroke={metrica === 'TEMPERATURA' ? '#e76f51' : '#457b9d'}
                            strokeWidth="1.2"
                            vectorEffect="non-scaling-stroke"
                          />
                        )
                      })}
                    </svg>
                    <div className="monitoreo-grafica__leyenda">
                      <span>
                        Mín {resumenSerieDato.min.toFixed(1)} · Máx{' '}
                        {resumenSerieDato.max.toFixed(1)} · Último{' '}
                        {resumenSerieDato.ultimo.toFixed(1)}
                      </span>
                      <span>
                        {datos.series.length} serie(s) · {resumenSerieDato.total} puntos
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </article>
      </section>

      {/* ===================== Alertas ambientales activas (IoT) ===================== */}
      <section className="monitoreo-salas-seccion">
        <header className="monitoreo-seccion-header">
          <div className="monitoreo-seccion-header__izq">
            <span className="monitoreo-icono-titulo">
              <IconoAdvertencia />
            </span>
            <h2 className="monitoreo-seccion-titulo">Alertas ambientales activas</h2>
          </div>
          <button
            type="button"
            className="monitoreo-link-todos"
            onClick={() => (window.location.hash = '#/admin/alertas')}
          >
            <span>Gestionar alertas</span>
          </button>
        </header>

        {alertasEstado === 'cargando' && (
          <div className="monitoreo-vacio" role="status">
            <span>Cargando alertas…</span>
          </div>
        )}
        {alertasEstado === 'error' && (
          <div className="monitoreo-vacio" role="alert">
            <IconoAdvertencia />
            <span>No se pudieron cargar las alertas.</span>
          </div>
        )}
        {alertasEstado === 'ok' && alertasIot.length === 0 && (
          <div className="monitoreo-vacio" role="status">
            <IconoCheck />
            <span>No hay alertas ambientales activas.</span>
          </div>
        )}
        {alertasEstado === 'ok' && alertasIot.length > 0 && (
          <div className="monitoreo-alertas-lista">
            {alertasIot.map((al) => {
              const critica = al.severidad === 'CRITICA'
              return (
                <article
                  key={al.id}
                  className={`monitoreo-alerta-fila${critica ? ' monitoreo-alerta-fila--critica' : ''}`}
                >
                  <span className="monitoreo-alerta-fila__badge">
                    {critica ? 'Crítica' : al.severidad === 'ADVERTENCIA' ? 'Advertencia' : 'Info'}
                  </span>
                  <div className="monitoreo-alerta-fila__info">
                    <span className="monitoreo-alerta-fila__descripcion">{al.descripcion}</span>
                    <span className="monitoreo-alerta-fila__meta">
                      {al.sensorCodigo ? `Sensor ${al.sensorCodigo}` : 'Sin sensor'}
                      {al.salaNombre ? ` · ${al.salaNombre}` : ''}
                    </span>
                  </div>
                  <span className="monitoreo-alerta-fila__fecha">
                    {formatearFecha(al.iniciadaEn)}
                  </span>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* ===================== Fila Inferior: Lecturas y Presencia ===================== */}
      <section className="monitoreo-bottom-grid">
        {/* Lecturas recientes de sensores (Tabla) */}
        <article className="monitoreo-tabla-card">
          <header className="monitoreo-tabla-header">
            <div className="monitoreo-tabla-header__izq">
              <span className="monitoreo-icono-titulo">
                <IconoReloj />
              </span>
              <h2 className="monitoreo-seccion-titulo">Lecturas recientes de sensores</h2>
            </div>

            <div className="monitoreo-tabla-filtros">
              <label className="monitoreo-select-wrap">
                <span>Sala:</span>
                <select value={filtroSala} onChange={(e) => setFiltroSala(e.target.value)}>
                  <option value="Todas">Todas</option>
                  {opcionesSala.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="monitoreo-select-wrap">
                <span>Métrica:</span>
                <select value={filtroMetrica} onChange={(e) => setFiltroMetrica(e.target.value)}>
                  <option value="Todas">Todas</option>
                  <option value="TEMPERATURA">Temperatura</option>
                  <option value="HUMEDAD">Humedad</option>
                  <option value="LUZ">Luz</option>
                  <option value="PRESENCIA">Presencia</option>
                </select>
              </label>
            </div>
          </header>

          {lecturasFiltradas.length === 0 ? (
            <div className="monitoreo-vacio" role="status">
              <IconoBuscar />
              <span>
                {lecturas.length === 0
                  ? 'Todavía no hay lecturas registradas.'
                  : 'Ninguna lectura coincide con los filtros.'}
              </span>
            </div>
          ) : (
          <>
          <div className="monitoreo-tabla-contenedor">
            <table className="monitoreo-tabla">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Sensor</th>
                  <th>Sala / Exhibición</th>
                  <th>Métrica</th>
                  <th>Valor</th>
                  <th>Estado envío</th>
                </tr>
              </thead>
              <tbody>
                {lecturasPaginadas.map((lec) => (
                  <tr key={`${lec.sensorId}-${lec.metrica}`}>
                    <td data-label="Fecha y hora">{formatearFecha(lec.medidoEn)}</td>
                    <td data-label="Sensor"><code>{lec.sensorCodigo}</code></td>
                    <td data-label="Sala / Exhibición">{lec.sala || lec.exhibicion || '—'}</td>
                    <td data-label="Métrica">{etiquetaMetrica(lec.metrica)}</td>
                    <td data-label="Valor">
                      {Number(lec.valor).toFixed(1)}
                      {lec.unidad ? ` ${lec.unidad}` : ''}
                    </td>
                    <td data-label="Estado envío">
                      <span className="monitoreo-badge-conectado">{lec.estadoOutbox}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="monitoreo-paginacion">
            <span className="monitoreo-paginacion__conteo">
              Mostrando {indiceInicio + 1} -{' '}
              {Math.min(indiceInicio + elementosPorPagina, lecturasFiltradas.length)} de{' '}
              {lecturasFiltradas.length} lecturas
            </span>

            <Paginacion
              paginaActual={paginaActual}
              totalPaginas={totalPaginas}
              onCambiar={setPaginaActual}
            />

            <div className="monitoreo-paginacion__por-pag">
              <span>Mostrar {elementosPorPagina} por página</span>
            </div>
          </footer>
          </>
          )}
        </article>

        {/* Resumen de presencia (real; sin distribución por sala inventada) */}
        <article className="monitoreo-presencia-card">
          <header className="monitoreo-seccion-header">
            <div className="monitoreo-seccion-header__izq">
              <span className="monitoreo-icono-titulo">
                <IconoUsuarios />
              </span>
              <h2 className="monitoreo-seccion-titulo">Presencia actual</h2>
            </div>
          </header>

          {!presencia || presencia.sensoresConDato === 0 ? (
            <div className="monitoreo-vacio" role="status">
              <IconoBuscar />
              <span>Todavía no hay lecturas de presencia.</span>
            </div>
          ) : (
            <div className="presencia-resumen">
              <div className="presencia-resumen__dato">
                <span className="presencia-resumen__valor">
                  {presencia.exhibicionesConPresencia}
                </span>
                <span className="presencia-resumen__etiqueta">
                  Exhibiciones con presencia detectada
                </span>
              </div>
              <p className="presencia-resumen__nota">
                Calculado con la última lectura de cada sensor de presencia (
                {presencia.sensoresConDato} con dato). Las exhibiciones sin lectura no se
                cuentan como vacías.
              </p>
            </div>
          )}
        </article>
      </section>
      </>
      )}
    </div>
  )
}
