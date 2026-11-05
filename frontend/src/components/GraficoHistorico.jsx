// ============================================================
// Gráfica histórica (Apache ECharts) — Monitoreo IoT
// ------------------------------------------------------------
// Carga DIFERIDA (React.lazy) solo en Monitoreo IoT. Importa únicamente los
// módulos de ECharts que usa (treeshaking).
//
// Fuente de datos: GET /api/v1/admin/monitoreo/historico (InfluxDB).
// El backend agrega cada ventana (mean) según el rango y devuelve también
// mínimo y máximo de la ventana, además de `intervaloMinutos`.
//
// Dos vistas:
//   - "Por sala" (predeterminada): 6 gráficas pequeñas con ejes de tiempo
//     sincronizados, franja de rango ideal y tramos fuera de rango en rojo.
//   - "Comparar": una sola gráfica con todas las salas y las tarjetas de
//     resumen como leyenda (clic para mostrar/ocultar).
//
// Los huecos reales de datos (sistema apagado, sensor sin enviar) se cortan
// con `null` + `connectNulls: false` y se sombrean con la etiqueta "Sin datos".
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkAreaComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { obtenerHistorico } from '../data/monitoreoApi'
import { ErrorHttp } from '../data/httpClient'
import { IconoAdvertencia, IconoBuscar } from './iconos'
import './GraficoHistorico.css'

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkAreaComponent,
  VisualMapComponent,
  CanvasRenderer,
])

const METRICAS = [
  { clave: 'TEMPERATURA', etiqueta: 'Temperatura', unidad: '°C' },
  { clave: 'HUMEDAD', etiqueta: 'Humedad', unidad: '%' },
  { clave: 'LUZ', etiqueta: 'Luminosidad', unidad: 'lux' },
]

const RANGOS = [
  { horas: 1, etiqueta: 'Última hora' },
  { horas: 6, etiqueta: '6 h' },
  { horas: 24, etiqueta: '24 h' },
  { horas: 168, etiqueta: '7 días' },
]

const VISTAS = [
  { clave: 'salas', etiqueta: 'Por sala' },
  { clave: 'comparar', etiqueta: 'Comparar' },
]

// Paleta de 6 colores claramente distintos y accesibles (inspirada en Okabe-Ito).
// Evita los tres tonos cálidos parecidos de la versión anterior.
const PALETA = [
  '#0072B2', // azul
  '#E69F00', // naranja
  '#009E73', // verde
  '#CC79A7', // magenta
  '#56B4E9', // celeste
  '#D55E00', // bermellón
]

const COLOR_FUERA = '#C0392B'
const REFRESCO_MS = 60_000

function metricaActual(clave) {
  return METRICAS.find((m) => m.clave === clave) || METRICAS[0]
}

function nombreSala(serie) {
  if (serie.salaNombre) {
    const etiqueta = serie.salaOrden != null ? serie.salaOrden : serie.salaId ?? '?'
    return `Sala ${etiqueta} · ${serie.salaNombre}`
  }
  return `Sensor ${serie.sensor}`
}

function claveSerie(serie) {
  return serie.sensor
}

function intervaloPorRango(horas) {
  if (horas <= 1) return 1
  if (horas <= 6) return 5
  if (horas <= 24) return 15
  return 60
}

function formatearHora(valor, rangoHoras) {
  const fecha = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(fecha.getTime())) return ''
  if (rangoHoras >= 168) {
    return fecha.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }
  return fecha.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatearValor(valor, unidad) {
  if (valor == null || !Number.isFinite(Number(valor))) return '—'
  return `${Number(valor).toFixed(1)} ${unidad}`.trim()
}

function mensajeDeError(error) {
  if (error instanceof ErrorHttp) {
    if (error.tipo === 'conexion') {
      return 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.'
    }
    if (error.tipo === 'autorizacion') {
      return 'Tu sesión ha expirado o no tienes permisos para ver el histórico.'
    }
    return error.message || 'No se pudo cargar el histórico.'
  }
  return 'No se pudo cargar el histórico.'
}

/**
 * Convierte los puntos agregados en datos de ECharts, cortando la línea cuando
 * entre dos muestras pasa más de 3 veces el intervalo de agregación. Devuelve
 * también los huecos detectados (para sombrearlos).
 */
function procesarSerie(serie, intervaloMinutos, inicio, fin) {
  const puntos = (serie.puntos || [])
    .map((p) => ({
      t: new Date(p.tiempo).getTime(),
      v: Number(p.valor),
      mn: p.minimo != null ? Number(p.minimo) : null,
      mx: p.maximo != null ? Number(p.maximo) : null,
    }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
    .sort((a, b) => a.t - b.t)

  const umbral = intervaloMinutos * 60_000 * 3
  const datos = []
  const huecos = []

  if (puntos.length === 0) {
    // Sin ninguna muestra en el periodo: todo el rango es un hueco.
    if (inicio != null && fin != null && fin > inicio) {
      huecos.push({ inicio, fin })
    }
  } else {
    if (inicio != null && puntos[0].t - inicio > umbral) {
      huecos.push({ inicio, fin: puntos[0].t })
    }
    let anterior = null
    for (const punto of puntos) {
      if (anterior != null && punto.t - anterior > umbral) {
        huecos.push({ inicio: anterior, fin: punto.t })
        // Punto nulo en el centro del hueco: corta la línea sin duplicar el
        // instante anterior (connectNulls: false).
        datos.push([anterior + (punto.t - anterior) / 2, null])
      }
      datos.push([punto.t, punto.v, punto.mn, punto.mx])
      anterior = punto.t
    }
    if (fin != null && fin - anterior > umbral) {
      huecos.push({ inicio: anterior, fin })
    }
  }

  const valores = puntos.map((p) => p.v)
  const actual = valores.length ? valores[valores.length - 1] : null
  const vecesFuera = puntos.filter(
    (p) =>
      (serie.limiteMin != null && p.v < serie.limiteMin) ||
      (serie.limiteMax != null && p.v > serie.limiteMax),
  ).length
  const fueraAhora =
    actual != null &&
    ((serie.limiteMin != null && actual < serie.limiteMin) ||
      (serie.limiteMax != null && actual > serie.limiteMax))

  return { serie, datos, huecos, puntos, actual, vecesFuera, fueraAhora }
}

function fusionarHuecos(huecos) {
  const ordenados = [...huecos].sort((a, b) => a.inicio - b.inicio)
  const resultado = []
  for (const hueco of ordenados) {
    const ultimo = resultado[resultado.length - 1]
    if (ultimo && hueco.inicio <= ultimo.fin) {
      ultimo.fin = Math.max(ultimo.fin, hueco.fin)
    } else {
      resultado.push({ ...hueco })
    }
  }
  return resultado
}

function pasoBonito(span, objetivos = 5) {
  if (!Number.isFinite(span) || span <= 0) return 1
  const bruto = span / objetivos
  const magnitud = 10 ** Math.floor(Math.log10(bruto))
  const normalizado = bruto / magnitud
  let paso
  if (normalizado <= 1) paso = 1
  else if (normalizado <= 2) paso = 2
  else if (normalizado <= 2.5) paso = 2.5
  else if (normalizado <= 5) paso = 5
  else paso = 10
  return paso * magnitud
}

// Dominio Y con margen para que las líneas no toquen el borde, redondeado a
// pasos legibles (evita etiquetas como 30.73093524836260).
function dominioY(valores, extras = []) {
  const numeros = [...valores, ...extras].filter((v) => Number.isFinite(v))
  if (numeros.length === 0) return {}
  let min = Math.min(...numeros)
  let max = Math.max(...numeros)
  if (min === max) {
    min -= 1
    max += 1
  }
  const margen = (max - min) * 0.12
  const paso = pasoBonito(max - min + margen * 2)
  const inferior = Math.floor((min - margen) / paso) * paso
  const superior = Math.ceil((max + margen) / paso) * paso
  return {
    min: Number(inferior.toFixed(6)),
    max: Number(superior.toFixed(6)),
    interval: paso,
  }
}

function itemsDeHuecos(huecos) {
  // La etiqueta "Sin datos" se muestra solo en el hueco más ancho para no
  // saturar las gráficas pequeñas con varios rótulos iguales.
  let indiceEtiqueta = -1
  let anchoMaximo = -1
  huecos.forEach((h, i) => {
    const ancho = h.fin - h.inicio
    if (ancho > anchoMaximo) {
      anchoMaximo = ancho
      indiceEtiqueta = i
    }
  })
  return huecos.map((h, i) => [
    {
      xAxis: h.inicio,
      itemStyle: { color: 'rgba(107, 114, 128, 0.10)' },
      label: {
        show: i === indiceEtiqueta,
        position: 'insideTop',
        color: '#8c8273',
        fontSize: 10,
        formatter: 'Sin datos',
      },
    },
    { xAxis: h.fin },
  ])
}

function marcaSinDatos(huecos) {
  return {
    silent: true,
    itemStyle: { color: 'rgba(107, 114, 128, 0.10)' },
    data: itemsDeHuecos(huecos),
  }
}

function opcionSala(procesada, dominioTiempo, dominio, metricaInfo, rangoHoras, color) {
  const { serie, datos, huecos } = procesada
  const unidad = metricaInfo.unidad
  const limMin = serie.limiteMin
  const limMax = serie.limiteMax

  // Franja de rango ideal: solo si la sala tiene algún límite configurado.
  const items = []
  const tieneLimites = limMin != null || limMax != null
  if (tieneLimites && dominio.min != null && dominio.max != null) {
    const inferior = limMin ?? dominio.min
    const superior = limMax ?? dominio.max
    if (superior > inferior) {
      items.push([
        {
          yAxis: inferior,
          itemStyle: { color: 'rgba(169, 116, 28, 0.10)' },
          label: {
            show: true,
            position: 'insideTopLeft',
            color: '#8a6a33',
            fontSize: 9,
            formatter: 'Rango ideal',
          },
        },
        { yAxis: superior },
      ])
    }
  }
  items.push(...itemsDeHuecos(huecos))

  // Tramos fuera del rango ideal en rojo; el resto con el color de la sala.
  const piezas = []
  if (limMin != null) piezas.push({ lt: limMin, color: COLOR_FUERA })
  if (limMax != null) piezas.push({ gt: limMax, color: COLOR_FUERA })
  if (piezas.length > 0) {
    piezas.push({
      gte: limMin ?? -1e15,
      lte: limMax ?? 1e15,
      color,
    })
  }

  const series = [
    {
      name: nombreSala(serie),
      type: 'line',
      smooth: 0.25,
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 6,
      connectNulls: false,
      sampling: 'lttb',
      lineStyle: piezas.length ? { width: 2.2 } : { width: 2.2, color },
      itemStyle: piezas.length ? undefined : { color },
      emphasis: { focus: 'series', lineStyle: { width: 4 } },
      markArea: items.length ? { silent: true, data: items } : undefined,
      data: datos,
    },
  ]

  return {
    animationDuration: 220,
    grid: { left: 42, right: 12, top: 12, bottom: 26 },
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: { type: 'line', lineStyle: { color: '#bfae90' } },
      backgroundColor: 'rgba(255, 253, 248, 0.98)',
      borderColor: 'rgba(33, 25, 15, 0.12)',
      textStyle: { color: '#2b241c', fontSize: 12 },
      formatter: (params) => {
        const p = (params || []).find((x) => x.value != null && x.value[1] != null)
        if (!p) return ''
        const [, valor, minimo, maximo] = p.value
        const hora = formatearHora(p.value[0], rangoHoras)
        const filas = [
          `<div style="font-weight:600;margin-bottom:4px">${hora}</div>`,
          `<div>Promedio <strong>${Number(valor).toFixed(1)} ${unidad}</strong></div>`,
        ]
        if (minimo != null && maximo != null) {
          filas.push(
            `<div style="color:#736c61">Mín ${Number(minimo).toFixed(1)} · Máx ` +
              `${Number(maximo).toFixed(1)} ${unidad}</div>`,
          )
        }
        return filas.join('')
      },
    },
    xAxis: {
      type: 'time',
      min: dominioTiempo.inicio ?? undefined,
      max: dominioTiempo.fin ?? undefined,
      axisLine: { lineStyle: { color: 'rgba(33, 25, 15, 0.18)' } },
      axisLabel: {
        color: '#8c8273',
        fontSize: 10,
        hideOverlap: true,
        formatter: (valor) => formatearHora(valor, rangoHoras),
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: dominio.min,
      max: dominio.max,
      interval: dominio.interval,
      name: unidad,
      nameTextStyle: { color: '#8c8273', fontSize: 10 },
      axisLabel: { color: '#8c8273', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(33, 25, 15, 0.06)' } },
    },
    dataZoom: [{ type: 'inside', filterMode: 'none' }],
    visualMap: piezas.length
      ? {
          show: false,
          type: 'piecewise',
          dimension: 1,
          seriesIndex: 0,
          pieces: piezas,
          outOfRange: { color },
        }
      : undefined,
    series,
  }
}

function opcionComparar(
  procesadas,
  seleccion,
  dominioTiempo,
  dominio,
  metricaInfo,
  rangoHoras,
  colorPorClave,
) {
  const unidad = metricaInfo.unidad
  const visibles = procesadas.filter((p) => seleccion.has(claveSerie(p.serie)))

  const series = visibles.map((p) => ({
    name: nombreSala(p.serie),
    type: 'line',
    smooth: 0.25,
    showSymbol: false,
    symbol: 'circle',
    symbolSize: 6,
    connectNulls: false,
    sampling: 'lttb',
    lineStyle: { width: 2.2, color: colorPorClave.get(claveSerie(p.serie)) },
    itemStyle: { color: colorPorClave.get(claveSerie(p.serie)) },
    emphasis: { focus: 'series', lineStyle: { width: 4 } },
    data: p.datos,
  }))

  // Un solo sombreado con la unión de huecos de las series visibles.
  const huecos = fusionarHuecos(visibles.flatMap((p) => p.huecos))
  if (huecos.length > 0) {
    series.push({
      name: 'Sin datos',
      type: 'line',
      data: [],
      silent: true,
      tooltip: { show: false },
      markArea: marcaSinDatos(huecos),
    })
  }

  return {
    animationDuration: 220,
    grid: { left: 54, right: 18, top: 18, bottom: 74 },
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: { type: 'line', lineStyle: { color: '#bfae90' } },
      backgroundColor: 'rgba(255, 253, 248, 0.98)',
      borderColor: 'rgba(33, 25, 15, 0.12)',
      textStyle: { color: '#2b241c', fontSize: 12 },
      formatter: (params) => {
        const puntos = (params || []).filter(
          (p) => p.seriesName !== 'Sin datos' && p.value != null && p.value[1] != null,
        )
        if (puntos.length === 0) return ''
        const hora = formatearHora(puntos[0].value[0], rangoHoras)
        const filas = [...puntos]
          .sort((a, b) => Number(b.value[1]) - Number(a.value[1]))
          .map(
            (p) =>
              `<div style="display:flex;align-items:center;gap:6px;margin-top:3px">` +
              `<span style="width:9px;height:9px;border-radius:50%;background:${p.color};display:inline-block"></span>` +
              `<span style="flex:1">${p.seriesName}</span>` +
              `<strong>${Number(p.value[1]).toFixed(1)} ${unidad}</strong></div>`,
          )
          .join('')
        return `<div style="font-weight:600;margin-bottom:4px">${hora}</div>${filas}`
      },
    },
    xAxis: {
      type: 'time',
      min: dominioTiempo.inicio ?? undefined,
      max: dominioTiempo.fin ?? undefined,
      axisLine: { lineStyle: { color: 'rgba(33, 25, 15, 0.18)' } },
      axisLabel: {
        color: '#8c8273',
        fontSize: 11,
        hideOverlap: true,
        formatter: (valor) => formatearHora(valor, rangoHoras),
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: dominio.min,
      max: dominio.max,
      interval: dominio.interval,
      name: unidad,
      nameTextStyle: { color: '#8c8273', fontSize: 11 },
      axisLabel: { color: '#8c8273', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(33, 25, 15, 0.06)' } },
    },
    dataZoom: [
      { type: 'inside', filterMode: 'none' },
      {
        type: 'slider',
        height: 18,
        bottom: 16,
        borderColor: 'transparent',
        backgroundColor: 'rgba(33, 25, 15, 0.04)',
        fillerColor: 'rgba(169, 116, 28, 0.18)',
        handleStyle: { color: '#a9741c' },
        textStyle: { color: '#8c8273', fontSize: 10 },
      },
    ],
    series,
  }
}

export default function GraficoHistorico() {
  const [metrica, setMetrica] = useState('TEMPERATURA')
  const [rangoHoras, setRangoHoras] = useState(1)
  const [vista, setVista] = useState('salas')
  const [datos, setDatos] = useState(null)
  const [estado, setEstado] = useState('cargando') // cargando|ok|error|vacio
  const [error, setError] = useState(null)
  const [seleccionadas, setSeleccionadas] = useState(null) // Set de códigos

  // Clave estable por métrica+rango: reinicia el zoom al cambiar el dominio.
  const claveReinicio = `${metrica}:${rangoHoras}`

  const cargar = useCallback(
    async (signal) => {
      const hasta = new Date()
      const desde = new Date(hasta.getTime() - rangoHoras * 60 * 60 * 1000)
      setEstado((prev) => (prev === 'ok' ? prev : 'cargando'))
      setError(null)
      try {
        const respuesta = await obtenerHistorico({
          metrica,
          desde: desde.toISOString(),
          hasta: hasta.toISOString(),
          signal,
        })
        const series = respuesta?.series || []
        // Con series (aunque estén vacías en este periodo) se muestra la
        // cuadrícula y cada tarjeta indica "Sin datos recientes". Solo si no
        // hay ninguna serie se muestra el estado vacío.
        setDatos(respuesta)
        setEstado(series.length > 0 ? 'ok' : 'vacio')
        setSeleccionadas((prev) => {
          const disponibles = series.map(claveSerie)
          if (!prev) return new Set(disponibles)
          const siguiente = new Set([...prev].filter((k) => disponibles.includes(k)))
          return siguiente.size > 0 ? siguiente : new Set(disponibles)
        })
      } catch (e) {
        if (e?.name === 'AbortError') return
        setError(mensajeDeError(e))
        setEstado('error')
      }
    },
    [metrica, rangoHoras],
  )

  useEffect(() => {
    const controlador = new AbortController()
    cargar(controlador.signal)
    return () => controlador.abort()
  }, [cargar, metrica, rangoHoras])

  // Actualización automática cada 60 s sin perder zoom ni selección.
  useEffect(() => {
    const controlador = new AbortController()
    const intervalo = setInterval(() => cargar(controlador.signal), REFRESCO_MS)
    return () => {
      controlador.abort()
      clearInterval(intervalo)
    }
  }, [cargar])

  const metricaInfo = metricaActual(metrica)
  const series = useMemo(() => datos?.series || [], [datos])
  const intervaloMinutos = datos?.intervaloMinutos || intervaloPorRango(rangoHoras)

  const dominioTiempo = useMemo(
    () => ({
      inicio: datos?.desde ? new Date(datos.desde).getTime() : null,
      fin: datos?.hasta ? new Date(datos.hasta).getTime() : null,
    }),
    [datos],
  )

  const procesadas = useMemo(() => {
    const lista = series
      .map((s) => procesarSerie(s, intervaloMinutos, dominioTiempo.inicio, dominioTiempo.fin))
      .sort((a, b) => {
        const oa = a.serie.salaOrden ?? Number.MAX_SAFE_INTEGER
        const ob = b.serie.salaOrden ?? Number.MAX_SAFE_INTEGER
        return oa - ob || claveSerie(a.serie).localeCompare(claveSerie(b.serie))
      })
    return lista
  }, [series, intervaloMinutos, dominioTiempo])

  const colorPorClave = useMemo(() => {
    const mapa = new Map()
    procesadas.forEach((p, i) => mapa.set(claveSerie(p.serie), PALETA[i % PALETA.length]))
    return mapa
  }, [procesadas])

  const seleccionEfectiva = useMemo(() => seleccionadas || new Set(), [seleccionadas])

  const alternarSala = (clave) => {
    setSeleccionadas((prev) => {
      const base = new Set(prev || [])
      if (base.has(clave)) base.delete(clave)
      else base.add(clave)
      return base
    })
  }
  const seleccionarTodas = () =>
    setSeleccionadas(new Set(procesadas.map((p) => claveSerie(p.serie))))
  const quitarTodas = () => setSeleccionadas(new Set())

  const dominioGlobal = useMemo(() => {
    if (vista === 'salas') return {}
    const visibles = procesadas.filter((p) => seleccionEfectiva.has(claveSerie(p.serie)))
    return dominioY(visibles.flatMap((p) => p.puntos.map((x) => x.v)))
  }, [vista, procesadas, seleccionEfectiva])

  const dominioPorSala = useMemo(() => {
    const mapa = new Map()
    if (vista !== 'salas') return mapa
    procesadas.forEach((p) => {
      mapa.set(
        claveSerie(p.serie),
        dominioY(
          p.puntos.map((x) => x.v),
          [p.serie.limiteMin, p.serie.limiteMax],
        ),
      )
    })
    return mapa
  }, [vista, procesadas])

  const opcionesSalas = useMemo(() => {
    if (vista !== 'salas') return []
    return procesadas.map((p) =>
      opcionSala(
        p,
        dominioTiempo,
        dominioPorSala.get(claveSerie(p.serie)) || {},
        metricaInfo,
        rangoHoras,
        colorPorClave.get(claveSerie(p.serie)),
      ),
    )
  }, [vista, procesadas, dominioTiempo, dominioPorSala, metricaInfo, rangoHoras, colorPorClave])

  const opcionComparada = useMemo(() => {
    if (vista !== 'comparar') return null
    return opcionComparar(
      procesadas,
      seleccionEfectiva,
      dominioTiempo,
      dominioGlobal,
      metricaInfo,
      rangoHoras,
      colorPorClave,
    )
  }, [
    vista,
    procesadas,
    seleccionEfectiva,
    dominioTiempo,
    dominioGlobal,
    metricaInfo,
    rangoHoras,
    colorPorClave,
  ])

  // Todas las gráficas de una misma vista comparten grupo: ECharts sincroniza
  // el eje de tiempo, el tooltip y el zoom entre ellas.
  const grupo = `historico-${metrica}-${rangoHoras}-${vista}`
  const registrar = useCallback(
    (instancia) => {
      if (!instancia) return
      instancia.group = grupo
      echarts.connect(grupo)
    },
    [grupo],
  )

  const haySeleccion = seleccionEfectiva.size > 0

  return (
    <div className="grafico-hist">
      <header className="grafico-hist__header">
        <div className="grafico-hist__titulo-wrap">
          <h2 className="monitoreo-grafica__titulo">Histórico ambiental</h2>
          <span className="monitoreo-grafica__subtitulo">
            InfluxDB · promedio por ventana · {rangoHoras === 1 ? '1 min' : intervaloMinutos + ' min'}
          </span>
        </div>
        <div className="grafico-hist__acciones">
          <div className="grafico-hist__vistas" role="group" aria-label="Vista">
            {VISTAS.map((v) => (
              <button
                key={v.clave}
                type="button"
                className={`grafico-hist__vista-btn${vista === v.clave ? ' is-activo' : ''}`}
                aria-pressed={vista === v.clave}
                onClick={() => setVista(v.clave)}
              >
                {v.etiqueta}
              </button>
            ))}
          </div>
          <div className="grafico-hist__rango" role="group" aria-label="Rango temporal">
            {RANGOS.map((r) => (
              <button
                key={r.horas}
                type="button"
                className={`grafico-hist__rango-btn${rangoHoras === r.horas ? ' is-activo' : ''}`}
                aria-pressed={rangoHoras === r.horas}
                onClick={() => setRangoHoras(r.horas)}
              >
                {r.etiqueta}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grafico-hist__tabs" role="tablist" aria-label="Métrica">
        {METRICAS.map((m) => (
          <button
            key={m.clave}
            type="button"
            role="tab"
            aria-selected={metrica === m.clave}
            className={`grafico-hist__tab${metrica === m.clave ? ' is-activo' : ''}`}
            onClick={() => setMetrica(m.clave)}
          >
            {m.etiqueta} <span className="grafico-hist__tab-unidad">({m.unidad})</span>
          </button>
        ))}
      </div>

      {estado === 'cargando' && (
        <div className="grafico-hist__esqueleto" role="status" aria-label="Cargando histórico">
          <div className="grafico-hist__esqueleto-area" />
        </div>
      )}

      {estado === 'error' && (
        <div className="monitoreo-vacio" role="alert">
          <IconoAdvertencia />
          <span>{error}</span>
          <button type="button" className="monitoreo-aviso__boton" onClick={() => cargar()}>
            Reintentar
          </button>
        </div>
      )}

      {estado === 'vacio' && (
        <div className="monitoreo-vacio" role="status">
          <IconoBuscar />
          <span>No hay mediciones en este periodo.</span>
        </div>
      )}

      {estado === 'ok' && vista === 'salas' && (
        <div className="grafico-hist__salas">
          {procesadas.map((p, i) => {
            const clave = claveSerie(p.serie)
            const color = colorPorClave.get(clave)
            const sinDatos = p.puntos.length === 0
            return (
              <article
                key={clave}
                className={`grafico-hist__sala-card${p.fueraAhora ? ' is-fuera' : ''}`}
              >
                <header className="grafico-hist__sala-header">
                  <span
                    className="grafico-hist__punto"
                    style={{ background: color }}
                    aria-hidden="true"
                  />
                  <h3 className="grafico-hist__sala-nombre">{nombreSala(p.serie)}</h3>
                </header>

                <div className="grafico-hist__sala-dato">
                  <span className="grafico-hist__sala-valor">
                    {sinDatos ? '—' : formatearValor(p.actual, metricaInfo.unidad)}
                  </span>
                  <span
                    className={`grafico-hist__sala-estado${
                      p.fueraAhora ? ' is-fuera' : sinDatos ? ' is-vacio' : ' is-ok'
                    }`}
                  >
                    {sinDatos
                      ? 'Sin datos recientes'
                      : p.fueraAhora
                        ? 'Fuera de rango ahora'
                        : 'Dentro de rango'}
                  </span>
                </div>

                {p.vecesFuera > 0 && (
                  <span className="grafico-hist__sala-veces">
                    {p.vecesFuera} {p.vecesFuera === 1 ? 'vez' : 'veces'} fuera de rango
                  </span>
                )}

                <div className="grafico-hist__sala-canvas">
                  <ReactEChartsCore
                    key={`${claveReinicio}:${clave}`}
                    echarts={echarts}
                    option={opcionesSalas[i]}
                    style={{ height: 148, width: '100%' }}
                    notMerge={false}
                    replaceMerge={['series']}
                    lazyUpdate
                    onChartReady={registrar}
                  />
                </div>
              </article>
            )
          })}
        </div>
      )}

      {estado === 'ok' && vista === 'comparar' && (
        <>
          <div className="grafico-hist__resumen" aria-label="Resumen por sala (leyenda)">
            {procesadas.map((p) => {
              const clave = claveSerie(p.serie)
              const activa = seleccionEfectiva.has(clave)
              return (
                <button
                  key={clave}
                  type="button"
                  className={`grafico-hist__resumen-item${p.fueraAhora ? ' is-fuera' : ''}${
                    activa ? '' : ' is-oculta'
                  }`}
                  aria-pressed={activa}
                  onClick={() => alternarSala(clave)}
                >
                  <span className="grafico-hist__resumen-nombre">
                    <span
                      className="grafico-hist__punto"
                      style={{ background: colorPorClave.get(clave) }}
                      aria-hidden="true"
                    />
                    {nombreSala(p.serie)}
                  </span>
                  <span className="grafico-hist__resumen-datos">
                    <span>
                      Actual <strong>{formatearValor(p.actual, metricaInfo.unidad)}</strong>
                    </span>
                    {p.fueraAhora && <span className="grafico-hist__fuera">Fuera de rango</span>}
                    {p.vecesFuera > 0 && (
                      <span className="grafico-hist__veces">{p.vecesFuera} fuera</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="grafico-hist__leyenda-botones">
            <button type="button" onClick={seleccionarTodas}>
              Todas
            </button>
            <button type="button" onClick={quitarTodas}>
              Ninguna
            </button>
          </div>

          {haySeleccion ? (
            <div className="grafico-hist__canvas">
              <ReactEChartsCore
                key={claveReinicio}
                echarts={echarts}
                option={opcionComparada}
                style={{ height: 380, width: '100%' }}
                notMerge={false}
                replaceMerge={['series']}
                lazyUpdate
                onChartReady={registrar}
              />
            </div>
          ) : (
            <div className="monitoreo-vacio" role="status">
              <span>Selecciona al menos una sala para ver la comparación.</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
