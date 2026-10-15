import { useState, useMemo } from 'react'
import {
  IconoAnalitica,
  IconoTemplo,
  IconoReloj,
  IconoCheck,
  IconoChevron,
  IconoCorona,
} from './iconos'
import {
  metricasPopularidad,
  distribucionSalas,
  rankingExhibiciones,
} from '../data/popularidadData'
import './Popularidad.css'

export default function Popularidad() {
  const [periodo, setPeriodo] = useState('24h')
  const [filtroSala, setFiltroSala] = useState('Todas')
  const [filtroOrden, setFiltroOrden] = useState('visitas')

  // Filtrado y ordenamiento de exhibiciones
  const listaFiltrada = useMemo(() => {
    let res = rankingExhibiciones.filter((item) => {
      if (filtroSala !== 'Todas' && !item.sala.includes(filtroSala)) return false
      return true
    })

    if (filtroOrden === 'visitas') {
      res = [...res].sort((a, b) => b.visitas - a.visitas)
    } else if (filtroOrden === 'nombre') {
      res = [...res].sort((a, b) => a.nombre.localeCompare(b.nombre))
    }
    return res
  }, [filtroSala, filtroOrden])

  return (
    <div className="popularidad-vista">
      {/* ===================== Cabecera de Página ===================== */}
      <header className="popularidad-cabecera">
        <div className="popularidad-cabecera__textos">
          <h1 className="popularidad-cabecera__titulo">Popularidad</h1>
          <p className="popularidad-cabecera__subtitulo">
            Visualiza el interés, afluencia y ranking de visitas de las exhibiciones del museo.
          </p>
        </div>

        <div className="popularidad-cabecera__filtro">
          <button
            type="button"
            className="popularidad-filtro-btn"
            onClick={() => setPeriodo((p) => (p === '24h' ? '7d' : p === '7d' ? '30d' : '24h'))}
          >
            <IconoReloj />
            <span>
              {periodo === '24h'
                ? 'Últimas 24 horas'
                : periodo === '7d'
                  ? 'Últimos 7 días'
                  : 'Últimos 30 días'}
            </span>
            <IconoChevron />
          </button>
        </div>
      </header>

      {/* ===================== 4 Tarjetas de Métricas ===================== */}
      <section className="popularidad-stats" aria-label="Indicadores de popularidad">
        {/* Card 1: Visitas Totales */}
        <article className="pop-stat-card">
          <div className="pop-stat__icono pop-stat__icono--visitas">
            <IconoAnalitica />
          </div>
          <div className="pop-stat__cuerpo">
            <span className="pop-stat__valor">{metricasPopularidad.visitasTotales}</span>
            <span className="pop-stat__etiqueta">Visitas totales</span>
            <span className="pop-stat__subnota texto-verde">
              {metricasPopularidad.variacionVisitas}
            </span>
          </div>
          <svg className="pop-stat__sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M0,32 Q25,35 45,22 T80,24 T100,10 L100,40 L0,40 Z" fill="rgba(198, 161, 91, 0.15)" />
            <path d="M0,32 Q25,35 45,22 T80,24 T100,10" fill="none" stroke="#c6a15b" strokeWidth="2" />
          </svg>
        </article>

        {/* Card 2: Más Visitada */}
        <article className="pop-stat-card">
          <div className="pop-stat__icono pop-stat__icono--corona">
            <IconoCorona />
          </div>
          <div className="pop-stat__cuerpo">
            <span className="pop-stat__valor pop-stat__valor--texto">
              {metricasPopularidad.exhibicionMasVista}
            </span>
            <span className="pop-stat__etiqueta">Exhibición más vista</span>
            <span className="pop-stat__subnota">{metricasPopularidad.salaMasVista}</span>
          </div>
          <svg className="pop-stat__sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M0,35 Q30,15 50,28 T85,18 T100,8 L100,40 L0,40 Z" fill="rgba(231, 111, 81, 0.15)" />
            <path d="M0,35 Q30,15 50,28 T85,18 T100,8" fill="none" stroke="#e76f51" strokeWidth="2" />
          </svg>
        </article>

        {/* Card 3: Tiempo promedio */}
        <article className="pop-stat-card">
          <div className="pop-stat__icono pop-stat__icono--tiempo">
            <IconoReloj />
          </div>
          <div className="pop-stat__cuerpo">
            <span className="pop-stat__valor">{metricasPopularidad.tiempoPromedio}</span>
            <span className="pop-stat__etiqueta">Tiempo promedio</span>
            <span className="pop-stat__subnota">{metricasPopularidad.tiempoDetalle}</span>
          </div>
          <svg className="pop-stat__sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M0,28 Q20,38 45,25 T75,18 T100,14 L100,40 L0,40 Z" fill="rgba(69, 123, 157, 0.15)" />
            <path d="M0,28 Q20,38 45,25 T75,18 T100,14" fill="none" stroke="#457b9d" strokeWidth="2" />
          </svg>
        </article>

        {/* Card 4: Satisfacción */}
        <article className="pop-stat-card">
          <div className="pop-stat__icono pop-stat__icono--check">
            <IconoCheck />
          </div>
          <div className="pop-stat__cuerpo">
            <span className="pop-stat__valor">{metricasPopularidad.tasaSatisfaccion}</span>
            <span className="pop-stat__etiqueta">Tasa de satisfacción</span>
            <span className="pop-stat__subnota">{metricasPopularidad.satisfaccionDetalle}</span>
          </div>
          <svg className="pop-stat__sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
            <path d="M0,35 Q20,38 35,28 T70,18 T100,8 L100,40 L0,40 Z" fill="rgba(42, 157, 143, 0.15)" />
            <path d="M0,35 Q20,38 35,28 T70,18 T100,8" fill="none" stroke="#2a9d8f" strokeWidth="2" />
          </svg>
        </article>
      </section>

      {/* ===================== Gráficas (2 Columnas) ===================== */}
      <section className="popularidad-graficas-grid">
        {/* Gráfica 1: Curva de Tendencia de Visitas */}
        <article className="popularidad-grafica-card">
          <header className="popularidad-grafica__header">
            <div className="popularidad-grafica__titulo-wrap">
              <span className="popularidad-grafica__icono">
                <IconoAnalitica />
              </span>
              <div>
                <h2 className="popularidad-grafica__titulo">Tendencia de visitas</h2>
                <span className="popularidad-grafica__subtitulo">
                  {periodo === '24h'
                    ? 'Horas del día (flujo de visitantes)'
                    : 'Días del periodo seleccionado'}
                </span>
              </div>
            </div>
          </header>

          <div className="pop-svg-wrap">
            <div className="pop-y-eje">
              <span>1.000</span>
              <span>750</span>
              <span>500</span>
              <span>250</span>
              <span>0</span>
            </div>

            <div className="pop-chart-area">
              <svg viewBox="0 0 600 180" preserveAspectRatio="none" className="grafica-svg">
                <defs>
                  <linearGradient id="grad-visitas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c6a15b" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#c6a15b" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Área bajo la curva */}
                <path
                  d="M0,150 C60,140 100,110 160,80 C220,50 280,70 340,35 C400,20 460,65 520,100 C560,120 580,130 600,140 L600,180 L0,180 Z"
                  fill="url(#grad-visitas)"
                />

                {/* Línea dorada */}
                <path
                  d="M0,150 C60,140 100,110 160,80 C220,50 280,70 340,35 C400,20 460,65 520,100 C560,120 580,130 600,140"
                  fill="none"
                  stroke="#c6a15b"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>

              <div className="pop-x-eje">
                <span>08:00</span>
                <span>10:00</span>
                <span>12:00</span>
                <span>14:00</span>
                <span>16:00</span>
                <span>18:00</span>
                <span>20:00</span>
              </div>
            </div>
          </div>
          <span className="pop-eje-label-y">Visitas</span>
        </article>

        {/* Gráfica 2: Distribución de interés por sala (Donut) */}
        <article className="popularidad-grafica-card">
          <header className="popularidad-grafica__header">
            <div className="popularidad-grafica__titulo-wrap">
              <span className="popularidad-grafica__icono">
                <IconoTemplo />
              </span>
              <div>
                <h2 className="popularidad-grafica__titulo">Distribución de visitas por sala</h2>
                <span className="popularidad-grafica__subtitulo">Porcentaje sobre el total</span>
              </div>
            </div>
          </header>

          <div className="pop-donut-wrap">
            <div className="pop-donut-svg-wrap">
              <svg viewBox="0 0 160 160" className="donut-svg" aria-label="Visitas por sala">
                <circle cx="80" cy="80" r="58" fill="none" stroke="#f1ece1" strokeWidth="22" />
                {/* Sala 1 (22% = 80.1) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke="#d4af37"
                  strokeWidth="22"
                  strokeDasharray="80.1 364"
                  strokeDashoffset="91"
                />
                {/* Sala 2 (20% = 72.8) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke="#e5a842"
                  strokeWidth="22"
                  strokeDasharray="72.8 364"
                  strokeDashoffset="10.9"
                />
                {/* Sala 3 (35% = 127.4) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke="#2a9d8f"
                  strokeWidth="22"
                  strokeDasharray="127.4 364"
                  strokeDashoffset="-61.9"
                />
                {/* Sala 4 (23% = 83.7) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke="#e76f51"
                  strokeWidth="22"
                  strokeDasharray="83.7 364"
                  strokeDashoffset="-189.3"
                />
              </svg>
              <div className="donut-centro">
                <span className="donut-centro__valor">{metricasPopularidad.visitasTotales}</span>
                <span className="donut-centro__etiqueta">Visitas</span>
              </div>
            </div>

            <div className="pop-leyenda-lista">
              {distribucionSalas.map((s) => (
                <div key={s.sala} className="pop-leyenda-item">
                  <span className="pop-leyenda__punto" style={{ backgroundColor: s.color }} />
                  <div className="pop-leyenda__info">
                    <span className="pop-leyenda__nombre">{s.sala}</span>
                    <span className="pop-leyenda__conteo">
                      {s.visitas} ({s.porcentaje}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      {/* ===================== Ranking Completo de Exhibiciones ===================== */}
      <section className="popularidad-ranking-card">
        <header className="popularidad-ranking-header">
          <div className="popularidad-ranking-header__izq">
            <span className="popularidad-icono-titulo">
              <IconoCorona />
            </span>
            <h2 className="popularidad-seccion-titulo">
              Ranking de exhibiciones más populares
            </h2>
          </div>

          <div className="popularidad-ranking-filtros">
            <label className="pop-select-wrap">
              <span>Sala:</span>
              <select value={filtroSala} onChange={(e) => setFiltroSala(e.target.value)}>
                <option value="Todas">Todas las salas</option>
                <option value="Sala 1">Sala 1</option>
                <option value="Sala 2">Sala 2</option>
                <option value="Sala 3">Sala 3</option>
                <option value="Sala 4">Sala 4</option>
              </select>
            </label>

            <label className="pop-select-wrap">
              <span>Ordenar por:</span>
              <select value={filtroOrden} onChange={(e) => setFiltroOrden(e.target.value)}>
                <option value="visitas">Más visitadas</option>
                <option value="nombre">Nombre (A - Z)</option>
              </select>
            </label>
          </div>
        </header>

        <div className="pop-ranking-lista">
          {listaFiltrada.map((item, index) => (
            <article key={item.id} className="pop-ranking-fila">
              <span className="pop-ranking-puesto">#{index + 1}</span>
              <img src={item.imagen} alt={item.nombre} className="pop-ranking-thumb" />

              <div className="pop-ranking-info">
                <h3 className="pop-ranking-nombre">{item.nombre}</h3>
                <span className="pop-ranking-sala">{item.sala}</span>
              </div>

              <div className="pop-ranking-barra-wrap">
                <div className="pop-ranking-barra-fondo">
                  <div
                    className="pop-ranking-barra-progreso"
                    style={{ width: `${item.porcentaje}%` }}
                  />
                </div>
              </div>

              <div className="pop-ranking-numeros">
                <span className="pop-ranking-visitas">{item.visitas.toLocaleString('es-CO')}</span>
                <span className="pop-ranking-label">visitas</span>
              </div>

              <div className="pop-ranking-tendencia">
                <span
                  className={`tendencia-pill ${item.tendencia >= 0 ? 'tendencia-pill--sube' : 'tendencia-pill--baja'}`}
                >
                  {item.tendencia >= 0 ? `+${item.tendencia} %` : `${item.tendencia} %`}
                </span>
                <span className="pop-ranking-calif">{item.calificacion}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
