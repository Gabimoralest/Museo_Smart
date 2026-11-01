import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  IconoAnalitica,
  IconoCheck,
  IconoCorona,
  IconoAdvertencia,
  IconoBuscar,
} from './iconos'
import { obtenerRanking } from '../data/popularidadApi'
import { ErrorHttp } from '../data/httpClient'
import './Popularidad.css'

// ------------------------------------------------------------------
// El backend solo expone el ranking de popularidad:
//   { posicion, exhibicionId, codigo, titulo, salaId, salaNombre,
//     totalVisitasValidas }
// ordenado por visitas válidas desc y título asc (empates comparten
// posición). Los indicadores sin respaldo en el backend (tendencia
// temporal, tiempo promedio, satisfacción, calificación, distribución
// por sala) se calculan SOLO a partir del ranking real o se eliminan.
// No se usan datos ficticios.
// ------------------------------------------------------------------

// El ranking no incluye la imagen de la exhibición; se muestra un marcador
// neutro cuando no hay recurso, sin inventar imágenes por id.
function imagenPara() {
  return null
}
function mensajeDeError(error, porDefecto) {
  if (error instanceof ErrorHttp) {
    if (error.tipo === 'conexion') {
      return 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.'
    }
    if (error.tipo === 'autorizacion') {
      return 'Tu sesión ha expirado o no tienes permisos para ver la popularidad.'
    }
    return error.message || porDefecto
  }
  return porDefecto
}

export default function Popularidad() {
  const [ranking, setRanking] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)

  const [filtroSala, setFiltroSala] = useState('Todas')
  const [filtroOrden, setFiltroOrden] = useState('visitas')

  const cargarRanking = useCallback(async (signal) => {
    setCargando(true)
    setErrorCarga(null)
    try {
      const datos = await obtenerRanking({ signal })
      setRanking((datos || []).map((dto) => ({ ...dto, imagen: imagenPara(dto.exhibicionId) })))
    } catch (error) {
      if (error?.name === 'AbortError') return
      setErrorCarga(mensajeDeError(error, 'No se pudo cargar el ranking de popularidad.'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    const controlador = new AbortController()
    cargarRanking(controlador.signal)
    return () => controlador.abort()
  }, [cargarRanking])

  // Métricas derivadas del ranking real.
  const visitasTotales = useMemo(
    () => ranking.reduce((acc, r) => acc + (r.totalVisitasValidas || 0), 0),
    [ranking],
  )
  const masVisitada = useMemo(() => ranking[0] || null, [ranking])
  const maxVisitas = masVisitada?.totalVisitasValidas || 0

  // Salas presentes en el ranking, para el filtro.
  const opcionesSala = useMemo(() => {
    const mapa = new Map()
    ranking.forEach((r) => {
      if (r.salaId != null && !mapa.has(r.salaId)) mapa.set(r.salaId, r.salaNombre)
    })
    return Array.from(mapa, ([id, nombre]) => ({ id, nombre }))
  }, [ranking])

  // Distribución de visitas por sala, calculada con los datos reales.
  const distribucionSalas = useMemo(() => {
    const acumulado = new Map()
    ranking.forEach((r) => {
      if (r.salaId == null) return
      const actual = acumulado.get(r.salaId) || { salaId: r.salaId, nombre: r.salaNombre, visitas: 0 }
      actual.visitas += r.totalVisitasValidas || 0
      acumulado.set(r.salaId, actual)
    })
    const total = Array.from(acumulado.values()).reduce((a, s) => a + s.visitas, 0)
    return Array.from(acumulado.values())
      .map((s) => ({ ...s, porcentaje: total > 0 ? Math.round((s.visitas / total) * 100) : 0 }))
      .sort((a, b) => b.visitas - a.visitas)
  }, [ranking])

  const COLORES_SALA = ['#d4af37', '#e5a842', '#2a9d8f', '#e76f51', '#8d5b94', '#457b9d']

  // El backend ya entrega el ranking ordenado (visitas desc, título asc).
  // El filtro de sala solo recorta; el "orden por nombre" es la única
  // reordenación permitida en cliente (A-Z) y recalcula la posición mostrada.
  const listaFiltrada = useMemo(() => {
    let res = ranking.filter((item) => filtroSala === 'Todas' || String(item.salaId) === filtroSala)
    if (filtroOrden === 'nombre') {
      res = [...res].sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'es'))
    }
    return res
  }, [ranking, filtroSala, filtroOrden])

  return (
    <div className="popularidad-vista">
      {/* ===================== Cabecera de Página ===================== */}
      <header className="popularidad-cabecera">
        <div className="popularidad-cabecera__textos">
          <h1 className="popularidad-cabecera__titulo">Popularidad</h1>
          <p className="popularidad-cabecera__subtitulo">
            Ranking de exhibiciones por interacciones válidas registradas.
          </p>
        </div>
      </header>

      {/* ===================== Aviso de error / carga ===================== */}
      {!cargando && errorCarga && (
        <div className="popularidad-aviso popularidad-aviso--error" role="alert">
          <IconoAdvertencia />
          <span>{errorCarga}</span>
          <button type="button" className="popularidad-aviso__boton" onClick={() => cargarRanking()}>
            Reintentar
          </button>
        </div>
      )}

      {/* ===================== 3 Tarjetas de Métricas (datos reales) ===================== */}
      {!cargando && !errorCarga && (
      <section className="popularidad-stats" aria-label="Indicadores de popularidad">
        {/* Card 1: Interacciones totales */}
        <article className="pop-stat-card">
          <div className="pop-stat__icono pop-stat__icono--visitas">
            <IconoAnalitica />
          </div>
          <div className="pop-stat__cuerpo">
            <span className="pop-stat__valor">{visitasTotales.toLocaleString('es-CO')}</span>
            <span className="pop-stat__etiqueta">Interacciones válidas</span>
            <span className="pop-stat__subnota">Suma del ranking actual</span>
          </div>
        </article>

        {/* Card 2: Más visitada */}
        <article className="pop-stat-card">
          <div className="pop-stat__icono pop-stat__icono--corona">
            <IconoCorona />
          </div>
          <div className="pop-stat__cuerpo">
            <span className="pop-stat__valor pop-stat__valor--texto">
              {masVisitada?.titulo || '—'}
            </span>
            <span className="pop-stat__etiqueta">Exhibición más popular</span>
            <span className="pop-stat__subnota">
              {masVisitada?.salaNombre || '—'}
              {masVisitada ? ` · ${masVisitada.totalVisitasValidas.toLocaleString('es-CO')} visitas` : ''}
            </span>
          </div>
        </article>

        {/* Card 3: Exhibiciones en el ranking */}
        <article className="pop-stat-card">
          <div className="pop-stat__icono pop-stat__icono--check">
            <IconoCheck />
          </div>
          <div className="pop-stat__cuerpo">
            <span className="pop-stat__valor">{ranking.length}</span>
            <span className="pop-stat__etiqueta">Exhibiciones en el ranking</span>
            <span className="pop-stat__subnota">{opcionesSala.length} salas representadas</span>
          </div>
        </article>
      </section>
      )}

      {/* ===================== Distribución de visitas por sala (dato real) ===================== */}
      {!cargando && !errorCarga && distribucionSalas.length > 0 && (
      <section className="popularidad-graficas-grid">
        <article className="popularidad-grafica-card popularidad-grafica-card--full">
          <header className="popularidad-grafica__header">
            <div className="popularidad-grafica__titulo-wrap">
              <span className="popularidad-grafica__icono">
                <IconoAnalitica />
              </span>
              <div>
                <h2 className="popularidad-grafica__titulo">Distribución de visitas por sala</h2>
                <span className="popularidad-grafica__subtitulo">Porcentaje sobre el total del ranking</span>
              </div>
            </div>
          </header>

          <div className="pop-leyenda-lista pop-leyenda-lista--barras">
            {distribucionSalas.map((s, idx) => (
              <div key={s.salaId} className="pop-dist-fila">
                <span className="pop-dist__nombre">{s.nombre}</span>
                <div className="pop-dist__barra-fondo">
                  <div
                    className="pop-dist__barra-progreso"
                    style={{
                      width: `${s.porcentaje}%`,
                      backgroundColor: COLORES_SALA[idx % COLORES_SALA.length],
                    }}
                  />
                </div>
                <span className="pop-dist__valor">
                  {s.visitas.toLocaleString('es-CO')} ({s.porcentaje}%)
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>
      )}

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
                {opcionesSala.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.nombre}
                  </option>
                ))}
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

        {cargando && (
          <div className="popularidad-estado" role="status" aria-live="polite">
            <p className="popularidad-estado__texto">Cargando ranking…</p>
          </div>
        )}

        {!cargando && !errorCarga && listaFiltrada.length === 0 && (
          <div className="popularidad-estado" role="status">
            <span className="popularidad-estado__icono" aria-hidden="true">
              <IconoBuscar />
            </span>
            <p className="popularidad-estado__texto">
              {ranking.length === 0
                ? 'Todavía no hay interacciones registradas.'
                : 'Ninguna exhibición coincide con el filtro de sala.'}
            </p>
          </div>
        )}

        {!cargando && !errorCarga && listaFiltrada.length > 0 && (
        <div className="pop-ranking-lista">
          {listaFiltrada.map((item, index) => {
            const porcentaje = maxVisitas > 0
              ? Math.round((item.totalVisitasValidas / maxVisitas) * 100)
              : 0
            // Si se reordena por nombre, mostramos la posición secuencial;
            // si no, la posición oficial del backend (empates la comparten).
            const posicion = filtroOrden === 'nombre'
              ? index + 1
              : (filtroSala === 'Todas' ? item.posicion : index + 1)
            return (
              <article key={item.exhibicionId} className="pop-ranking-fila">
                <span className="pop-ranking-puesto">#{posicion}</span>
                {item.imagen ? (<img src={item.imagen} alt={item.titulo} className="pop-ranking-thumb" />) : (<span className="pop-ranking-thumb pop-ranking-thumb--vacia" aria-hidden="true" />)}

                <div className="pop-ranking-info">
                  <h3 className="pop-ranking-nombre">{item.titulo}</h3>
                  <span className="pop-ranking-sala">{item.salaNombre}</span>
                </div>

                <div className="pop-ranking-barra-wrap">
                  <div className="pop-ranking-barra-fondo">
                    <div
                      className="pop-ranking-barra-progreso"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </div>

                <div className="pop-ranking-numeros">
                  <span className="pop-ranking-visitas">
                    {item.totalVisitasValidas.toLocaleString('es-CO')}
                  </span>
                  <span className="pop-ranking-label">visitas</span>
                </div>
              </article>
            )
          })}
        </div>
        )}
      </section>
    </div>
  )
}
