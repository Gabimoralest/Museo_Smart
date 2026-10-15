import { useState, useEffect, useCallback } from 'react'
import {
  IconoTemplo,
  IconoUsuarios,
  IconoCampana,
  IconoFlechaDerecha,
  IconoCorona,
  IconoAdvertencia,
  IconoAnalitica,
  IconoCheck,
  IconoBuscar,
} from './iconos'
import { imagenesPanel } from '../data/panelSuperAdmin'
import { listarExhibiciones } from '../data/exhibicionesApi'
import { listarAlertas } from '../data/alertasApi'
import { obtenerRanking } from '../data/popularidadApi'
import { listarUsuarios } from '../data/usuariosApi'
import { ErrorHttp } from '../data/httpClient'
import { imagenExhibicion } from '../data/exhibicionesData'
import './InicioDashboard.css'

// El backend no expone endpoints de sensores/lecturas ni de "actividad
// reciente"/historial de cambios. Solo se muestran indicadores con respaldo
// real: exhibiciones, alertas activas, interacciones (ranking) y, para
// SUPERADMIN, administradores. El resto se retira.

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

function imagenPara(exhibicionId) {
  const id = Number(exhibicionId)
  const indice = Number.isFinite(id) && id > 0 ? (id - 1) % IMAGENES_DISPONIBLES.length : 0
  return imagenExhibicion(IMAGENES_DISPONIBLES[indice])
}

function formatearFecha(iso) {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function etiquetaRol(rol) {
  if (rol === 'SUPERADMIN') return 'SuperAdmin'
  if (rol === 'ADMIN') return 'Administrador'
  return rol || '—'
}

function estiloAlerta(dto) {
  if (dto.estado !== 'ABIERTA' && dto.estado !== 'RECONOCIDA') return 'resuelta'
  if (dto.severidad === 'CRITICA') return 'critica'
  return 'advertencia'
}

function etiquetaSeveridad(sev) {
  if (sev === 'CRITICA') return 'Crítica'
  if (sev === 'ADVERTENCIA') return 'Advertencia'
  if (sev === 'INFO') return 'Info'
  return sev || '—'
}

function mensajeDeError(error, porDefecto) {
  if (error instanceof ErrorHttp) {
    if (error.tipo === 'conexion') {
      return 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.'
    }
    if (error.tipo === 'autorizacion') {
      return 'Tu sesión ha expirado o no tienes permisos para ver el resumen.'
    }
    return error.message || porDefecto
  }
  return porDefecto
}

export default function InicioDashboard({ sesion, onNavegar }) {
  const esSuperAdmin = (sesion?.rol || '').toUpperCase() === 'SUPERADMIN'

  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const [exhibiciones, setExhibiciones] = useState([])
  const [alertas, setAlertas] = useState([])
  const [ranking, setRanking] = useState([])
  const [usuarios, setUsuarios] = useState(null) // null = no disponible (no SUPERADMIN)

  const navegarA = (ruta) => {
    if (onNavegar) {
      onNavegar(ruta)
    } else if (typeof window !== 'undefined') {
      window.location.assign(ruta)
    }
  }

  // Carga paralela de los datos reales disponibles. Los administradores solo
  // se consultan para SUPERADMIN (el endpoint exige ese rol). Un fallo parcial
  // no descarta los datos que sí llegaron.
  const cargarResumen = useCallback(async (signal) => {
    setCargando(true)
    setErrorCarga(null)
    const tareas = [
      listarExhibiciones({ signal }).then((d) => setExhibiciones(d || [])),
      listarAlertas({ todas: true, signal }).then((d) => setAlertas(d || [])),
      obtenerRanking({ signal }).then((d) => setRanking(d || [])),
    ]
    if (esSuperAdmin) {
      tareas.push(listarUsuarios({ signal }).then((d) => setUsuarios(d || [])))
    }
    const resultados = await Promise.allSettled(tareas)
    const fallos = resultados.filter(
      (r) => r.status === 'rejected' && r.reason?.name !== 'AbortError',
    )
    if (fallos.length > 0) {
      setErrorCarga(
        mensajeDeError(fallos[0].reason, 'No se pudo cargar toda la información del resumen.'),
      )
    }
    setCargando(false)
  }, [esSuperAdmin])

  useEffect(() => {
    const controlador = new AbortController()
    cargarResumen(controlador.signal)
    return () => controlador.abort()
  }, [cargarResumen])

  // --- Datos derivados (reales) ---
  const totalExhibiciones = exhibiciones.length
  const activas = exhibiciones.filter((e) => e.activa).length
  const inactivas = totalExhibiciones - activas

  const alertasActivas = alertas.filter(
    (a) => a.estado === 'ABIERTA' || a.estado === 'RECONOCIDA',
  )
  const criticas = alertasActivas.filter((a) => a.severidad === 'CRITICA').length
  const advertencias = alertasActivas.filter((a) => a.severidad === 'ADVERTENCIA').length

  const interaccionesTotales = ranking.reduce((acc, r) => acc + (r.totalVisitasValidas || 0), 0)
  const masPopular = ranking[0] || null

  const usuariosActivos = usuarios ? usuarios.filter((u) => u.estado === 'ACTIVO').length : 0

  const alertasRecientes = [...alertas]
    .filter((a) => a.estado === 'ABIERTA' || a.estado === 'RECONOCIDA')
    .sort((a, b) => new Date(b.iniciadaEn || 0) - new Date(a.iniciadaEn || 0))
    .slice(0, 4)

  const populares = ranking.slice(0, 4)
  const maxVisitas = populares[0]?.totalVisitasValidas || 0

  // Tarjetas de resumen: solo con respaldo real.
  const tarjetas = [
    {
      id: 'exhibiciones',
      icono: 'templo',
      valor: totalExhibiciones,
      etiqueta: 'Exhibiciones',
      detalleVerde: `${activas} activas`,
      detalleRojo: `${inactivas} inactivas`,
      ruta: '#/admin/exhibiciones',
    },
    {
      id: 'alertas',
      icono: 'campana',
      valor: alertasActivas.length,
      etiqueta: 'Alertas activas',
      detalleRojo: criticas ? `${criticas} críticas` : null,
      detalleNaranja: advertencias ? `${advertencias} advertencias` : null,
      ruta: '#/admin/alertas',
    },
    {
      id: 'popularidad',
      icono: 'templo',
      valor: interaccionesTotales,
      etiqueta: 'Interacciones registradas',
      detalleVerde: masPopular ? `Más: ${masPopular.titulo}` : 'Sin interacciones',
      ruta: '#/admin/popularidad',
    },
  ]
  if (esSuperAdmin) {
    tarjetas.push({
      id: 'administradores',
      icono: 'usuarios',
      valor: usuarios ? usuarios.length : '—',
      etiqueta: 'Administradores',
      detalleVerde: usuarios ? `${usuariosActivos} activos` : null,
      ruta: '#/admin/administradores',
    })
  }

  const renderIconoMetrica = (tipo) => {
    if (tipo === 'templo') return <IconoTemplo />
    if (tipo === 'usuarios') return <IconoUsuarios />
    return <IconoCampana />
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
                Bienvenida, {sesion?.nombre || sesion?.correo || '—'}
              </h1>
              <span className="inicio-hero__badge-rol">
                {esSuperAdmin && <IconoCorona />} {etiquetaRol(sesion?.rol)}
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

      {/* ===================== Aviso de error ===================== */}
      {!cargando && errorCarga && (
        <div className="inicio-aviso inicio-aviso--error" role="alert">
          <IconoAdvertencia />
          <span>{errorCarga}</span>
          <button type="button" className="inicio-aviso__boton" onClick={() => cargarResumen()}>
            Reintentar
          </button>
        </div>
      )}

      {/* ===================== Carga ===================== */}
      {cargando && (
        <div className="inicio-estado" role="status" aria-live="polite">
          <p className="inicio-estado__texto">Cargando resumen…</p>
        </div>
      )}

      {/* ===================== Tarjetas de Estadísticas (datos reales) ===================== */}
      {!cargando && (
      <section className={`inicio-stats inicio-stats--${tarjetas.length}`} aria-label="Resumen general">
        {tarjetas.map((item) => (
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
          </article>
        ))}
      </section>
      )}

      {/* ===================== Grid de 2x2 (datos reales) ===================== */}
      {!cargando && (
      <section className="inicio-grid" aria-label="Módulos de estado">
        {/* Alertas activas */}
        <article className="inicio-card">
          <header className="inicio-card__cabecera">
            <div className="inicio-card__titulo-wrap">
              <span className="inicio-card__icono-cabecera">
                <IconoCampana />
              </span>
              <h2 className="inicio-card__titulo">Alertas activas</h2>
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

          {alertasRecientes.length === 0 ? (
            <div className="inicio-vacio" role="status">
              <IconoCheck />
              <span>No hay alertas activas.</span>
            </div>
          ) : (
            <div className="inicio-lista-alertas">
              {alertasRecientes.map((al) => {
                const estilo = estiloAlerta(al)
                return (
                  <div
                    key={al.id}
                    className="alerta-fila"
                    onClick={() => navegarA('#/admin/alertas')}
                  >
                    <div className={`alerta-fila__icono alerta-fila__icono--${estilo}`}>
                      {estilo === 'critica' ? '!' : <IconoAdvertencia />}
                    </div>
                    <div className="alerta-fila__textos">
                      <span className="alerta-fila__titulo">{al.descripcion}</span>
                      <span className="alerta-fila__sala">
                        {al.sensorCodigo || 'Sensor no asociado'}
                      </span>
                    </div>
                    <span className="alerta-fila__tiempo">{formatearFecha(al.iniciadaEn)}</span>
                    <span className={`alerta-fila__badge alerta-fila__badge--${estilo}`}>
                      {etiquetaSeveridad(al.severidad)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </article>

        {/* Exhibiciones más populares (ranking real) */}
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

          {populares.length === 0 ? (
            <div className="inicio-vacio" role="status">
              <IconoBuscar />
              <span>Todavía no hay interacciones registradas.</span>
            </div>
          ) : (
            <div className="inicio-populares">
              {populares.map((ex) => (
                <div
                  key={ex.exhibicionId}
                  className="popular-fila"
                  onClick={() => navegarA('#/admin/popularidad')}
                >
                  <span className="popular-fila__puesto">{ex.posicion}.</span>
                  <img src={imagenPara(ex.exhibicionId)} alt={ex.titulo} className="popular-fila__thumb" />
                  <div className="popular-fila__info">
                    <span className="popular-fila__nombre">{ex.titulo}</span>
                    <span className="popular-fila__sala">{ex.salaNombre}</span>
                  </div>
                  <div className="popular-fila__barra-wrap">
                    <div className="popular-fila__barra-fondo">
                      <div
                        className="popular-fila__barra-progreso"
                        style={{
                          width: `${maxVisitas > 0 ? Math.round((ex.totalVisitasValidas / maxVisitas) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="popular-fila__visitas">
                    <span className="popular-fila__visitas-num">
                      {ex.totalVisitasValidas.toLocaleString('es-CO')}
                    </span>
                    <span className="popular-fila__visitas-label">visitas</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
      )}
    </div>
  )
}
