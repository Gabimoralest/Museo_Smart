import { useState } from 'react'
import {
  IconoTemplo,
  IconoUsuarios,
  IconoAntena,
  IconoCampana,
  IconoFlechaDerecha,
  IconoCorona,
  IconoTermometro,
  IconoGota,
  IconoWifi,
  IconoLapiz,
  IconoBloqueo,
  IconoGaleria,
  IconoAnalitica,
  IconoReloj,
  IconoChevron,
} from './iconos'
import {
  resumenInicio,
  distribucionSensoresInicio,
  alertasRecientesInicio,
  exhibicionesPopularesInicio,
  actividadRecienteInicio,
  imagenesPanel,
} from '../data/panelSuperAdmin'
import './InicioDashboard.css'

export default function InicioDashboard({ sesion, onNavegar }) {
  const [periodo, setPeriodo] = useState('24h')

  const navegarA = (ruta) => {
    if (onNavegar) {
      onNavegar(ruta)
    } else if (typeof window !== 'undefined') {
      window.location.assign(ruta)
    }
  }

  // Renderizador de iconos de las tarjetas de métricas
  const renderIconoMetrica = (tipo) => {
    switch (tipo) {
      case 'templo':
        return <IconoTemplo />
      case 'usuarios':
        return <IconoUsuarios />
      case 'antena':
        return <IconoAntena />
      case 'campana':
      default:
        return <IconoCampana />
    }
  }

  // Sparklines SVG decorativos
  const renderSparkline = (color) => {
    let stroke = '#c6a15b'
    let fillGrad = 'spark-grad-oro'

    if (color === 'verde' || color === 'verde-menta') {
      stroke = '#2a9d8f'
      fillGrad = 'spark-grad-verde'
    } else if (color === 'rojo') {
      stroke = '#e76f51'
      fillGrad = 'spark-grad-rojo'
    }

    return (
      <svg className="tarjeta-stat__sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={fillGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path
          d="M0,35 Q20,38 35,28 T70,18 T100,8 L100,40 L0,40 Z"
          fill={`url(#${fillGrad})`}
        />
        <path
          d="M0,35 Q20,38 35,28 T70,18 T100,8"
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  // Iconos para la lista de alertas recientes
  const renderIconoAlerta = (icono) => {
    if (icono === 'termometro') return <IconoTermometro />
    if (icono === 'gota') return <IconoGota />
    if (icono === 'wifi') return <IconoWifi />
    return <IconoCampana />
  }

  // Iconos para la actividad reciente
  const renderIconoActividad = (icono) => {
    if (icono === 'lapiz') return <IconoLapiz />
    if (icono === 'usuarios') return <IconoUsuarios />
    if (icono === 'bloqueo') return <IconoBloqueo />
    if (icono === 'galeria') return <IconoGaleria />
    return <IconoReloj />
  }

  return (
    <div className="inicio-dashboard">
      {/* ===================== Banner Hero ===================== */}
      <section className="inicio-hero" aria-labelledby="inicio-hero-titulo">
        <div className="inicio-hero__fondo">
          <img
            src={imagenesPanel.banner}
            alt=""
            className="inicio-hero__imagen"
          />
          <div className="inicio-hero__overlay" aria-hidden="true" />
        </div>

        <div className="inicio-hero__contenido">
          <div className="inicio-hero__textos">
            <span className="inicio-hero__tag">MUSEO SMART</span>
            <div className="inicio-hero__titulo-grupo">
              <h1 id="inicio-hero-titulo" className="inicio-hero__titulo">
                Bienvenida, {sesion?.nombre || 'Gabs'}
              </h1>
              <span className="inicio-hero__badge-rol">
                <IconoCorona /> {sesion?.rol || 'SuperAdmin'}
              </span>
            </div>
            <p className="inicio-hero__subtitulo">
              Aquí puedes gestionar el museo, supervisar su estado y administrar a los administradores.
            </p>
          </div>

          <div className="inicio-hero__cita">
            <span className="inicio-hero__comillas">“</span>
            <p className="inicio-hero__frase">
              El arte conecta historias, y la tecnología las hace perdurar.
            </p>
            <span className="inicio-hero__comillas-cierre">”</span>
          </div>
        </div>
      </section>

      {/* ===================== 4 Tarjetas de Estadísticas ===================== */}
      <section className="inicio-stats" aria-label="Resumen general">
        {resumenInicio.map((item) => (
          <article
            key={item.id}
            className="tarjeta-stat"
            onClick={() => navegarA(item.ruta)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navegarA(item.ruta)}
          >
            <div className="tarjeta-stat__header">
              <div className={`tarjeta-stat__icono tarjeta-stat__icono--${item.icono}`}>
                {renderIconoMetrica(item.icono)}
              </div>
              <button
                type="button"
                className="tarjeta-stat__flecha"
                aria-label={`Ver sección ${item.etiqueta}`}
              >
                <IconoFlechaDerecha />
              </button>
            </div>

            <div className="tarjeta-stat__cuerpo">
              <span className="tarjeta-stat__valor">{item.valor}</span>
              <span className="tarjeta-stat__etiqueta">{item.etiqueta}</span>
              <div className="tarjeta-stat__detalle">
                {item.detalleVerde && (
                  <span className="texto-verde">{item.detalleVerde}</span>
                )}
                {item.detalleVerde && item.detalleRojo && <span> · </span>}
                {item.detalleRojo && (
                  <span className="texto-rojo">{item.detalleRojo}</span>
                )}
                {item.detalleNaranja && (
                  <span className="texto-naranja">{item.detalleNaranja}</span>
                )}
              </div>
            </div>

            {renderSparkline(item.sparkline)}
          </article>
        ))}
      </section>

      {/* ===================== Grid de 2x2 ===================== */}
      <section className="inicio-grid" aria-label="Módulos de estado">
        {/* Col 1, Fila 1: Estado de los sensores IoT */}
        <article className="inicio-card">
          <header className="inicio-card__cabecera">
            <div className="inicio-card__titulo-wrap">
              <span className="inicio-card__icono-cabecera">
                <IconoAnalitica />
              </span>
              <h2 className="inicio-card__titulo">Estado de los sensores IoT</h2>
            </div>

            <div className="inicio-card__filtro-tiempo">
              <button
                type="button"
                className="inicio-card__selector-btn"
                onClick={() => setPeriodo(periodo === '24h' ? '7d' : '24h')}
              >
                <IconoReloj />
                <span>{periodo === '24h' ? 'Últimas 24 horas' : 'Últimos 7 días'}</span>
                <IconoChevron />
              </button>
            </div>
          </header>

          <div className="inicio-sensores">
            <div className="inicio-sensores__grafico">
              <svg viewBox="0 0 160 160" className="donut-svg" aria-label="Distribución de sensores">
                <circle cx="80" cy="80" r="58" fill="none" stroke="#f1ece1" strokeWidth="20" />
                {/* Conectados (10/12 = 83.3%) -> dasharray = 303.4, 60.6 */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke="#2a9d8f"
                  strokeWidth="20"
                  strokeDasharray="303.4 364"
                  strokeDashoffset="91"
                  strokeLinecap="round"
                />
                {/* Advertencia (1/12 = 8.33%) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke="#e5a842"
                  strokeWidth="20"
                  strokeDasharray="30.3 364"
                  strokeDashoffset="-212.4"
                  strokeLinecap="round"
                />
                {/* Crítico (1/12 = 8.33%) */}
                <circle
                  cx="80"
                  cy="80"
                  r="58"
                  fill="none"
                  stroke="#e76f51"
                  strokeWidth="20"
                  strokeDasharray="30.3 364"
                  strokeDashoffset="-242.7"
                  strokeLinecap="round"
                />
              </svg>
              <div className="donut-centro">
                <span className="donut-centro__valor">{distribucionSensoresInicio.total}</span>
                <span className="donut-centro__etiqueta">Sensores</span>
              </div>
            </div>

            <div className="inicio-sensores__leyenda">
              {distribucionSensoresInicio.items.map((it) => (
                <div key={it.label} className="sensor-leyenda-item">
                  <span className="sensor-leyenda__punto" style={{ backgroundColor: it.color }} />
                  <span className="sensor-leyenda__label">{it.label}</span>
                  <span className="sensor-leyenda__valor">{it.valor}</span>
                  <span className="sensor-leyenda__porcentaje">{it.porcentaje}</span>
                </div>
              ))}
            </div>
          </div>
        </article>

        {/* Col 2, Fila 1: Alertas recientes */}
        <article className="inicio-card">
          <header className="inicio-card__cabecera">
            <div className="inicio-card__titulo-wrap">
              <span className="inicio-card__icono-cabecera">
                <IconoCampana />
              </span>
              <h2 className="inicio-card__titulo">Alertas recientes</h2>
            </div>
            <button
              type="button"
              className="inicio-card__link-mas"
              onClick={() => navegarA('#/admin/alertas')}
            >
              <span>Ver más</span>
              <IconoFlechaDerecha />
            </button>
          </header>

          <div className="inicio-lista-alertas">
            {alertasRecientesInicio.map((al) => (
              <div key={al.id} className="alerta-fila" onClick={() => navegarA('#/admin/alertas')}>
                <div className={`alerta-fila__icono alerta-fila__icono--${al.tipo}`}>
                  {renderIconoAlerta(al.icono)}
                </div>
                <div className="alerta-fila__textos">
                  <span className="alerta-fila__titulo">{al.titulo}</span>
                  <span className="alerta-fila__sala">{al.sala}</span>
                </div>
                <span className="alerta-fila__tiempo">{al.hace}</span>
                <span className={`alerta-fila__badge alerta-fila__badge--${al.tipo}`}>
                  {al.badge}
                </span>
              </div>
            ))}
          </div>
        </article>

        {/* Col 1, Fila 2: Exhibiciones más populares */}
        <article className="inicio-card">
          <header className="inicio-card__cabecera">
            <div className="inicio-card__titulo-wrap">
              <span className="inicio-card__icono-cabecera">
                <IconoAnalitica />
              </span>
              <h2 className="inicio-card__titulo">Exhibiciones más populares</h2>
            </div>
            <button
              type="button"
              className="inicio-card__link-mas"
              onClick={() => navegarA('#/admin/popularidad')}
            >
              <span>Ver más</span>
              <IconoFlechaDerecha />
            </button>
          </header>

          <div className="inicio-populares">
            {exhibicionesPopularesInicio.map((ex) => (
              <div key={ex.puesto} className="popular-fila" onClick={() => navegarA('#/admin/popularidad')}>
                <span className="popular-fila__puesto">{ex.puesto}.</span>
                <img src={ex.imagen} alt={ex.nombre} className="popular-fila__thumb" />
                <div className="popular-fila__info">
                  <span className="popular-fila__nombre">{ex.nombre}</span>
                  <span className="popular-fila__sala">{ex.sala}</span>
                </div>
                <div className="popular-fila__barra-wrap">
                  <div className="popular-fila__barra-fondo">
                    <div
                      className="popular-fila__barra-progreso"
                      style={{ width: `${ex.porcentaje}%` }}
                    />
                  </div>
                </div>
                <div className="popular-fila__visitas">
                  <span className="popular-fila__visitas-num">{ex.visitas}</span>
                  <span className="popular-fila__visitas-label">visitas</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* Col 2, Fila 2: Actividad reciente */}
        <article className="inicio-card">
          <header className="inicio-card__cabecera">
            <div className="inicio-card__titulo-wrap">
              <span className="inicio-card__icono-cabecera">
                <IconoLapiz />
              </span>
              <h2 className="inicio-card__titulo">Actividad reciente</h2>
            </div>
            <button
              type="button"
              className="inicio-card__link-mas"
              onClick={() => navegarA('#/admin/exhibiciones')}
            >
              <span>Ver más</span>
              <IconoFlechaDerecha />
            </button>
          </header>

          <div className="inicio-actividad">
            {actividadRecienteInicio.map((ac) => (
              <div key={ac.id} className="actividad-fila">
                <div className="actividad-fila__icono">
                  {renderIconoActividad(ac.icono)}
                </div>
                <div className="actividad-fila__info">
                  <span className="actividad-fila__accion">{ac.accion}</span>
                  <strong className="actividad-fila__elemento">{ac.elemento}</strong>
                </div>
                <div className="actividad-fila__meta">
                  <span className="actividad-fila__tiempo">{ac.hace}</span>
                  <span className="actividad-fila__autor">{ac.autor}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}
