import { useState, useMemo } from 'react'
import {
  IconoTermometro,
  IconoGota,
  IconoUsuarios,
  IconoWifi,
  IconoChevron,
  IconoReloj,
  IconoFlechaDerecha,
  IconoAnalitica,
} from './iconos'
import {
  metricasIoT,
  salasMonitoreo,
  lecturasSensores,
  distribucionPresencia,
} from '../data/monitoreoData'
import './MonitoreoIoT.css'

export default function MonitoreoIoT() {
  const [periodoGeneral, setPeriodoGeneral] = useState('24h')

  // Filtros de tabla
  const [filtroSala, setFiltroSala] = useState('Todas')
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [filtroEstado, setFiltroEstado] = useState('Todos')

  // Paginación de tabla de lecturas
  const [paginaActual, setPaginaActual] = useState(1)
  const elementosPorPagina = 5

  // Filtrado
  const lecturasFiltradas = useMemo(() => {
    return lecturasSensores.filter((item) => {
      if (filtroSala !== 'Todas' && item.sala !== filtroSala) return false
      if (filtroTipo !== 'Todos' && item.tipo !== filtroTipo) return false
      if (filtroEstado !== 'Todos' && item.estado !== filtroEstado) return false
      return true
    })
  }, [filtroSala, filtroTipo, filtroEstado])

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
            Visualiza en tiempo real las condiciones ambientales y el estado de los sensores del museo.
          </p>
        </div>

        <div className="monitoreo-cabecera__filtro">
          <button
            type="button"
            className="monitoreo-filtro-btn"
            onClick={() => setPeriodoGeneral((p) => (p === '24h' ? '7d' : '24h'))}
          >
            <IconoReloj />
            <span>{periodoGeneral === '24h' ? 'Últimas 24 horas' : 'Últimos 7 días'}</span>
            <IconoChevron />
          </button>
        </div>
      </header>

      {/* ===================== 4 Tarjetas de Métricas ===================== */}
      <section className="monitoreo-stats" aria-label="Indicadores IoT">
        {/* Tarjeta 1: Temperatura */}
        <article className="monitoreo-stat-card">
          <div className="monitoreo-stat__icono monitoreo-stat__icono--temp">
            <IconoTermometro />
          </div>
          <div className="monitoreo-stat__cuerpo">
            <span className="monitoreo-stat__valor">{metricasIoT.temperaturaPromedio}</span>
            <span className="monitoreo-stat__etiqueta">Temperatura promedio</span>
            <div className="monitoreo-stat__cambio">
              <span className="texto-verde">{metricasIoT.variacionTemperatura}</span>
              <span className="monitoreo-stat__cambio-nota">Respecto a la última lectura</span>
            </div>
          </div>
          {/* Sparkline curva roja */}
          <svg className="monitoreo-stat__sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M0,32 Q25,35 45,22 T80,24 T100,12 L100,40 L0,40 Z" fill="rgba(231, 111, 81, 0.15)" />
            <path d="M0,32 Q25,35 45,22 T80,24 T100,12" fill="none" stroke="#e76f51" strokeWidth="2" />
          </svg>
        </article>

        {/* Tarjeta 2: Humedad */}
        <article className="monitoreo-stat-card">
          <div className="monitoreo-stat__icono monitoreo-stat__icono--hum">
            <IconoGota />
          </div>
          <div className="monitoreo-stat__cuerpo">
            <span className="monitoreo-stat__valor">{metricasIoT.humedadPromedio}</span>
            <span className="monitoreo-stat__etiqueta">Humedad promedio</span>
            <div className="monitoreo-stat__cambio">
              <span className="texto-verde">{metricasIoT.variacionHumedad}</span>
              <span className="monitoreo-stat__cambio-nota">Respecto a la última lectura</span>
            </div>
          </div>
          {/* Sparkline curva azul */}
          <svg className="monitoreo-stat__sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M0,28 Q30,15 50,28 T85,18 T100,22 L100,40 L0,40 Z" fill="rgba(69, 123, 157, 0.15)" />
            <path d="M0,28 Q30,15 50,28 T85,18 T100,22" fill="none" stroke="#457b9d" strokeWidth="2" />
          </svg>
        </article>

        {/* Tarjeta 3: Presencia actual */}
        <article className="monitoreo-stat-card">
          <div className="monitoreo-stat__icono monitoreo-stat__icono--pres">
            <IconoUsuarios />
          </div>
          <div className="monitoreo-stat__cuerpo">
            <span className="monitoreo-stat__valor">{metricasIoT.presenciaActual}</span>
            <span className="monitoreo-stat__etiqueta">Presencia actual</span>
            <span className="monitoreo-stat__subnota">Visitantes en el museo virtual</span>
          </div>
          {/* Sparkline de barras verticales */}
          <div className="monitoreo-stat__barras-spark" aria-hidden="true">
            <span style={{ height: '35%' }} />
            <span style={{ height: '60%' }} />
            <span style={{ height: '85%' }} />
            <span style={{ height: '50%' }} />
            <span style={{ height: '100%' }} />
          </div>
        </article>

        {/* Tarjeta 4: Sensores Conectados */}
        <article className="monitoreo-stat-card">
          <div className="monitoreo-stat__icono monitoreo-stat__icono--sensores">
            <IconoWifi />
          </div>
          <div className="monitoreo-stat__cuerpo">
            <span className="monitoreo-stat__valor">{metricasIoT.sensoresConectados}</span>
            <span className="monitoreo-stat__etiqueta">Sensores conectados</span>
            <span className="monitoreo-stat__subnota">{metricasIoT.sensoresDetalle}</span>
          </div>
        </article>
      </section>

      {/* ===================== Gráficas Históricas (2 Cols) ===================== */}
      <section className="monitoreo-graficas-grid">
        {/* Gráfica 1: Temperatura */}
        <article className="monitoreo-grafica-card">
          <header className="monitoreo-grafica__header">
            <div className="monitoreo-grafica__titulo-wrap">
              <span className="monitoreo-grafica__icono monitoreo-grafica__icono--temp">
                <IconoTermometro />
              </span>
              <div>
                <h2 className="monitoreo-grafica__titulo">Histórico de temperatura</h2>
                <span className="monitoreo-grafica__subtitulo">Últimas 24 horas</span>
              </div>
            </div>

            <div className="monitoreo-grafica__filtros">
              <span className="monitoreo-tag-filtro">Sala: Todas <IconoChevron /></span>
              <span className="monitoreo-tag-filtro"><IconoReloj /> Últimas 24 horas <IconoChevron /></span>
              <span className="monitoreo-limite-badge monitoreo-limite-badge--temp">
                Límite máx. 30 °C
              </span>
            </div>
          </header>

          <div className="monitoreo-svg-wrap">
            <div className="monitoreo-y-eje">
              <span>35</span>
              <span>30</span>
              <span>25</span>
              <span>20</span>
              <span>15</span>
            </div>

            <div className="monitoreo-chart-area">
              <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="grafica-svg">
                <defs>
                  <linearGradient id="grad-temp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e76f51" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#e76f51" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Línea horizontal límite 30°C (y = 50px de 200px) */}
                <line
                  x1="0"
                  y1="50"
                  x2="600"
                  y2="50"
                  stroke="#e76f51"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />

                {/* Área de la curva */}
                <path
                  d="M0,130 C50,120 100,140 150,90 C200,60 250,110 300,60 C350,95 400,75 450,105 C500,125 550,85 600,105 L600,200 L0,200 Z"
                  fill="url(#grad-temp)"
                />

                {/* Línea de la curva */}
                <path
                  d="M0,130 C50,120 100,140 150,90 C200,60 250,110 300,60 C350,95 400,75 450,105 C500,125 550,85 600,105"
                  fill="none"
                  stroke="#e76f51"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>

              <div className="monitoreo-x-eje">
                <span>00:00</span>
                <span>04:00</span>
                <span>08:00</span>
                <span>12:00</span>
                <span>16:00</span>
                <span>20:00</span>
                <span>24:00</span>
              </div>
            </div>
          </div>
          <span className="monitoreo-eje-label-y">Temperatura (°C)</span>
        </article>

        {/* Gráfica 2: Humedad */}
        <article className="monitoreo-grafica-card">
          <header className="monitoreo-grafica__header">
            <div className="monitoreo-grafica__titulo-wrap">
              <span className="monitoreo-grafica__icono monitoreo-grafica__icono--hum">
                <IconoGota />
              </span>
              <div>
                <h2 className="monitoreo-grafica__titulo">Histórico de humedad</h2>
                <span className="monitoreo-grafica__subtitulo">Últimas 24 horas</span>
              </div>
            </div>

            <div className="monitoreo-grafica__filtros">
              <span className="monitoreo-tag-filtro">Sala: Todas <IconoChevron /></span>
              <span className="monitoreo-tag-filtro"><IconoReloj /> Últimas 24 horas <IconoChevron /></span>
              <span className="monitoreo-limite-badge monitoreo-limite-badge--hum">
                Límite máx. 80 %
              </span>
            </div>
          </header>

          <div className="monitoreo-svg-wrap">
            <div className="monitoreo-y-eje">
              <span>100</span>
              <span>80</span>
              <span>60</span>
              <span>40</span>
              <span>20</span>
              <span>0</span>
            </div>

            <div className="monitoreo-chart-area">
              <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="grafica-svg">
                <defs>
                  <linearGradient id="grad-hum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#457b9d" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#457b9d" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Línea horizontal límite 80% (y = 40px de 200px) */}
                <line
                  x1="0"
                  y1="40"
                  x2="600"
                  y2="40"
                  stroke="#457b9d"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />

                {/* Área de la curva */}
                <path
                  d="M0,120 C50,110 100,125 150,120 C200,80 250,95 300,70 C350,90 400,110 450,115 C500,70 550,95 600,100 L600,200 L0,200 Z"
                  fill="url(#grad-hum)"
                />

                {/* Línea de la curva */}
                <path
                  d="M0,120 C50,110 100,125 150,120 C200,80 250,95 300,70 C350,90 400,110 450,115 C500,70 550,95 600,100"
                  fill="none"
                  stroke="#457b9d"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>

              <div className="monitoreo-x-eje">
                <span>00:00</span>
                <span>04:00</span>
                <span>08:00</span>
                <span>12:00</span>
                <span>16:00</span>
                <span>20:00</span>
                <span>24:00</span>
              </div>
            </div>
          </div>
          <span className="monitoreo-eje-label-y">Humedad (%)</span>
        </article>
      </section>

      {/* ===================== Estado de sensores por sala ===================== */}
      <section className="monitoreo-salas-seccion">
        <header className="monitoreo-seccion-header">
          <div className="monitoreo-seccion-header__izq">
            <span className="monitoreo-icono-titulo">
              <IconoAnalitica />
            </span>
            <h2 className="monitoreo-seccion-titulo">Estado de sensores por sala</h2>
          </div>
          <button type="button" className="monitoreo-link-todos">
            <span>Ver todos los sensores</span>
            <IconoFlechaDerecha />
          </button>
        </header>

        <div className="monitoreo-salas-grid">
          {salasMonitoreo.map((sala) => (
            <article key={sala.id} className="sala-card">
              <img src={sala.imagen} alt={sala.nombre} className="sala-card__img" />
              <div className="sala-card__cuerpo">
                <div className="sala-card__titulo-fila">
                  <div>
                    <h3 className="sala-card__nombre">{sala.nombre}</h3>
                    <span className="sala-card__tipo">{sala.tipo}</span>
                  </div>
                  <IconoChevron className="sala-card__chevron" />
                </div>

                <div className="sala-card__sensores-estado">
                  <span className="punto-verde" />
                  <span>
                    {sala.sensoresOperativos} / {sala.sensoresTotal} sensores
                  </span>
                </div>

                <div className="sala-card__lecturas-lista">
                  <div className="sala-card__lectura-item">
                    <IconoTermometro />
                    <span>{sala.temperatura}</span>
                  </div>
                  <div className="sala-card__lectura-item">
                    <IconoGota />
                    <span>{sala.humedad}</span>
                  </div>
                  <div className="sala-card__lectura-item">
                    <IconoUsuarios />
                    <span>{sala.visitantes} visitantes</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ===================== Fila Inferior: Lecturas y Distribución ===================== */}
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
                  <option value="Sala 1">Sala 1</option>
                  <option value="Sala 2">Sala 2</option>
                  <option value="Sala 3">Sala 3</option>
                  <option value="Sala 4">Sala 4</option>
                </select>
              </label>

              <label className="monitoreo-select-wrap">
                <span>Tipo:</span>
                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                  <option value="Todos">Todos</option>
                  <option value="Ambiental">Ambiental</option>
                  <option value="Presencia">Presencia</option>
                </select>
              </label>

              <label className="monitoreo-select-wrap">
                <span>Estado:</span>
                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                  <option value="Todos">Todos</option>
                  <option value="Conectado">Conectado</option>
                </select>
              </label>
            </div>
          </header>

          <div className="monitoreo-tabla-contenedor">
            <table className="monitoreo-tabla">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Sala</th>
                  <th>Exhibición</th>
                  <th>Sensor</th>
                  <th>Temperatura</th>
                  <th>Humedad</th>
                  <th>Presencia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {lecturasPaginadas.map((lec) => (
                  <tr key={lec.id}>
                    <td>{lec.fechaHora}</td>
                    <td>{lec.sala}</td>
                    <td>{lec.exhibicion}</td>
                    <td><code>{lec.sensor}</code></td>
                    <td>{lec.temperatura}</td>
                    <td>{lec.humedad}</td>
                    <td>{lec.presencia}</td>
                    <td>
                      <span className="monitoreo-badge-conectado">
                        <span className="punto-verde" /> {lec.estado}
                      </span>
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

            <div className="monitoreo-paginacion__controles">
              <button
                type="button"
                className="monitoreo-btn-pag"
                disabled={paginaActual === 1}
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
              >
                &lt;
              </button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => (
                <button
                  type="button"
                  key={num}
                  className={`monitoreo-btn-pag${paginaActual === num ? ' monitoreo-btn-pag--activo' : ''}`}
                  onClick={() => setPaginaActual(num)}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="monitoreo-btn-pag"
                disabled={paginaActual === totalPaginas}
                onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
              >
                &gt;
              </button>
            </div>

            <div className="monitoreo-paginacion__por-pag">
              <span>Mostrar 5 por página</span>
            </div>
          </footer>
        </article>

        {/* Distribución de presencia por sala (Donut) */}
        <article className="monitoreo-presencia-card">
          <header className="monitoreo-seccion-header">
            <div className="monitoreo-seccion-header__izq">
              <span className="monitoreo-icono-titulo">
                <IconoUsuarios />
              </span>
              <h2 className="monitoreo-seccion-titulo">Distribución de presencia por sala</h2>
            </div>
          </header>

          <div className="presencia-donut-wrap">
            <div className="presencia-donut-svg-wrap">
              <svg viewBox="0 0 160 160" className="donut-svg" aria-label="Presencia por sala">
                <circle cx="80" cy="80" r="58" fill="none" stroke="#f1ece1" strokeWidth="22" />
                {/* Sala 1 (25% = 91) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke="#e5a842"
                  strokeWidth="22"
                  strokeDasharray="91 364"
                  strokeDashoffset="91"
                />
                {/* Sala 2 (29% = 105.5) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke="#e76f51"
                  strokeWidth="22"
                  strokeDasharray="105.5 364"
                  strokeDashoffset="0"
                />
                {/* Sala 3 (21% = 76.4) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke="#2a9d8f"
                  strokeWidth="22"
                  strokeDasharray="76.4 364"
                  strokeDashoffset="-105.5"
                />
                {/* Sala 4 (25% = 91) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke="#8d5b94"
                  strokeWidth="22"
                  strokeDasharray="91 364"
                  strokeDashoffset="-181.9"
                />
              </svg>
              <div className="donut-centro">
                <span className="donut-centro__valor">
                  {distribucionPresencia?.total ?? 28}
                </span>
                <span className="donut-centro__etiqueta">Visitantes actuales</span>
              </div>
            </div>

            <div className="presencia-leyenda-lista">
              {(distribucionPresencia?.salas || (Array.isArray(distribucionPresencia) ? distribucionPresencia : [])).map((item) => (
                <div key={item.sala} className="presencia-leyenda-item">
                  <span className="presencia-leyenda__punto" style={{ backgroundColor: item.color }} />
                  <div className="presencia-leyenda__info">
                    <span className="presencia-leyenda__nombre">{item.sala}</span>
                    <span className="presencia-leyenda__conteo">
                      {item.visitantes} ({item.porcentaje}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}
