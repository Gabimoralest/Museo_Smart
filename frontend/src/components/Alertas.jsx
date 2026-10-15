import { useState, useMemo } from 'react'
import {
  IconoCampana,
  IconoAdvertencia,
  IconoCheck,
  IconoOjo,
  IconoCruz,
  IconoReloj,
} from './iconos'
import { alertasIniciales } from '../data/alertasData'
import './Alertas.css'

export default function Alertas() {
  const [alertas, setAlertas] = useState(alertasIniciales)
  const [alertaSeleccionadaId, setAlertaSeleccionadaId] = useState(1)
  const [drawerAbierto, setDrawerAbierto] = useState(true)

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [filtroSensor, setFiltroSensor] = useState('Todos')
  const [filtroFecha, setFiltroFecha] = useState('7d')

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1)
  const elementosPorPagina = 10

  // Contadores dinámicos calculados
  const cuentaCriticas = useMemo(
    () => alertas.filter((a) => a.estado === 'Crítica').length,
    [alertas],
  )
  const cuentaAdvertencias = useMemo(
    () => alertas.filter((a) => a.estado === 'Advertencia').length,
    [alertas],
  )
  const cuentaResueltas = useMemo(
    () => alertas.filter((a) => a.estado === 'Resuelta').length,
    [alertas],
  )

  // Filtrado de alertas
  const alertasFiltradas = useMemo(() => {
    return alertas.filter((item) => {
      if (filtroEstado !== 'Todos' && item.estado !== filtroEstado) return false
      if (filtroTipo !== 'Todos' && item.tipoAlerta !== filtroTipo) return false
      if (filtroSensor !== 'Todos' && item.sensor !== filtroSensor) return false
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

  // Acción: Marcar como resuelta
  const marcarComoResuelta = (id) => {
    setAlertas((lista) =>
      lista.map((al) => {
        if (al.id === id) {
          return {
            ...al,
            estado: 'Resuelta',
            tipo: 'resuelta',
            resuelta: true,
          }
        }
        return al
      }),
    )
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

      {/* ===================== Barra de Filtros ===================== */}
      <section className="alertas-filtros-bar">
        <label className="alertas-filtro-item">
          <span className="alertas-filtro-label">
            <IconoReloj /> Estado
          </span>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="Todos">Todos</option>
            <option value="Crítica">Crítica</option>
            <option value="Advertencia">Advertencia</option>
            <option value="Resuelta">Resuelta</option>
          </select>
        </label>

        <label className="alertas-filtro-item">
          <span className="alertas-filtro-label">
            <IconoAdvertencia /> Tipo de alerta
          </span>
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="Todos">Todos</option>
            <option value="Humedad elevada">Humedad elevada</option>
            <option value="Temperatura fuera de rango">Temperatura fuera de rango</option>
            <option value="Restablecimiento">Restablecimiento</option>
          </select>
        </label>

        <label className="alertas-filtro-item">
          <span className="alertas-filtro-label">
            <IconoCampana /> Sensor
          </span>
          <select value={filtroSensor} onChange={(e) => setFiltroSensor(e.target.value)}>
            <option value="Todos">Todos</option>
            <option value="DHT22-01">DHT22-01</option>
            <option value="DHT22-02">DHT22-02</option>
            <option value="DHT22-03">DHT22-03</option>
            <option value="DHT22-04">DHT22-04</option>
          </select>
        </label>

        <label className="alertas-filtro-item">
          <span className="alertas-filtro-label">
            <IconoReloj /> Rango de fechas
          </span>
          <select value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)}>
            <option value="24h">Últimas 24 horas</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
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

          <div className="alertas-tabla-contenedor">
            <table className="alertas-tabla">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Tipo</th>
                  <th>Mensaje</th>
                  <th>Sensor</th>
                  <th>Ubicación</th>
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
                      <td>{item.fechaHora}</td>
                      <td>
                        <span className={`alerta-tipo-icono alerta-tipo-icono--${item.tipo}`}>
                          {item.tipo === 'critica' && '!'}
                          {item.tipo === 'advertencia' && <IconoAdvertencia />}
                          {item.tipo === 'resuelta' && <IconoCheck />}
                        </span>
                      </td>
                      <td className="col-mensaje">{item.mensaje}</td>
                      <td><code>{item.sensor}</code></td>
                      <td>{item.ubicacion}</td>
                      <td>
                        <span className={`alerta-estado-badge alerta-estado-badge--${item.tipo}`}>
                          ● {item.estado}
                        </span>
                      </td>
                      <td>
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

          <footer className="alertas-paginacion">
            <span className="alertas-paginacion__conteo">
              Mostrando {indiceInicio + 1} -{' '}
              {Math.min(indiceInicio + elementosPorPagina, alertasFiltradas.length)} de{' '}
              {alertasFiltradas.length} alertas
            </span>

            <div className="alertas-paginacion__controles">
              <button
                type="button"
                className="alertas-btn-pag"
                disabled={paginaActual === 1}
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
              >
                &lt;
              </button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => (
                <button
                  type="button"
                  key={num}
                  className={`alertas-btn-pag${paginaActual === num ? ' alertas-btn-pag--activo' : ''}`}
                  onClick={() => setPaginaActual(num)}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="alertas-btn-pag"
                disabled={paginaActual === totalPaginas}
                onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
              >
                &gt;
              </button>
            </div>

            <div className="alertas-paginacion__por-pag">
              <span>Mostrar 10 por página</span>
            </div>
          </footer>
        </article>

        {/* Panel lateral: Detalle de Alerta */}
        {drawerAbierto && alertaActual && (
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
              <div className={`alerta-detalle__badge-icono alerta-detalle__badge-icono--${alertaActual.tipo}`}>
                {alertaActual.tipo === 'critica' && '!'}
                {alertaActual.tipo === 'advertencia' && <IconoAdvertencia />}
                {alertaActual.tipo === 'resuelta' && <IconoCheck />}
              </div>
              <div className="alerta-detalle__hero-textos">
                <div className="alerta-detalle__hero-fila">
                  <h4 className="alerta-detalle__hero-titulo">{alertaActual.titulo}</h4>
                  <span className={`alerta-badge-pill alerta-badge-pill--${alertaActual.tipo}`}>
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
                <span className="alerta-meta-label">Ubicación</span>
                <span className="alerta-meta-valor">{alertaActual.ubicacion}</span>
              </div>
              <div className="alerta-meta-fila">
                <span className="alerta-meta-label">Tipo de alerta</span>
                <span className="alerta-meta-valor">{alertaActual.tipoAlerta}</span>
              </div>
              <div className="alerta-meta-fila">
                <span className="alerta-meta-label">Valor registrado</span>
                <span className="alerta-meta-valor">{alertaActual.valorRegistrado}</span>
              </div>
              <div className="alerta-meta-fila">
                <span className="alerta-meta-label">Umbral configurado</span>
                <span className="alerta-meta-valor">{alertaActual.umbralConfigurado}</span>
              </div>
              <div className="alerta-meta-fila">
                <span className="alerta-meta-label">Estado</span>
                <span className={`alerta-meta-valor alerta-meta-valor--${alertaActual.tipo}`}>
                  ● {alertaActual.estado}
                </span>
              </div>
            </div>

            <div className="alerta-detalle__seccion">
              <h5 className="alerta-detalle__seccion-titulo">Descripción</h5>
              <p className="alerta-detalle__descripcion">{alertaActual.descripcion}</p>
            </div>

            <div className="alerta-detalle__seccion">
              <h5 className="alerta-detalle__seccion-titulo">Acciones recomendadas</h5>
              <ul className="alerta-detalle__acciones-lista">
                {alertaActual.accionesRecomendadas?.map((acc, idx) => (
                  <li key={idx}>{acc}</li>
                ))}
              </ul>
            </div>

            <div className="alerta-detalle__footer">
              {alertaActual.estado !== 'Resuelta' ? (
                <button
                  type="button"
                  className="alerta-btn-resolver"
                  onClick={() => marcarComoResuelta(alertaActual.id)}
                >
                  <IconoCheck />
                  <span>Marcar como resuelta</span>
                </button>
              ) : (
                <div className="alerta-resuelta-aviso">
                  <IconoCheck />
                  <span>Incidencia resuelta</span>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
