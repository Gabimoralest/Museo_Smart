// ============================================================
// Simulador IoT — escenarios de demostración — Museo_Smart
// ------------------------------------------------------------
// Solo visible para SUPERADMIN y solo si el backend tiene habilitado el
// simulador (APP_SIMULADOR_HABILITADO=true). Si el backend responde 404 la
// sección se marca como no disponible y no se muestra en el panel.
//
// El estado real de los escenarios lo publica Node-RED en
// museo/simulador/estado (retained); el backend lo reenvía tal cual.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconoAdvertencia,
  IconoCheck,
  IconoReloj,
  IconoUsuarios,
  IconoRayo,
  IconoWifi,
  IconoInfo,
  IconoRecargar,
  IconoAntena,
} from './iconos'
import {
  obtenerEscenarios,
  activarEscenario,
  restablecerEscenarios,
  cambiarHorarioForzado,
} from '../data/simuladorApi'
import { listarSalasPublicas } from '../data/exhibicionesPublicasApi'
import { ErrorHttp } from '../data/httpClient'
import './Simulador.css'

const REFRESCO_MS = 15_000

const ESCENARIOS = [
  {
    tipo: 'FALLA_CLIMA',
    titulo: 'Falla del clima',
    objetivo: 'sala',
    icono: 'clima',
    resumen: 'La temperatura sube hacia 28 °C y la humedad baja.',
    porQue:
      'El calor acelera la degradación de pinturas y textiles y favorece hongos.',
  },
  {
    tipo: 'HUMEDAD_ALTA',
    titulo: 'Humedad alta',
    objetivo: 'sala',
    icono: 'humedad',
    resumen: 'La humedad sube gradualmente hasta ~75 %.',
    porQue:
      'Por encima del 60 % proliferan moho y corrosión en metales y cerámica.',
  },
  {
    tipo: 'EXCESO_LUZ',
    titulo: 'Exceso de luz',
    objetivo: 'sala',
    icono: 'luz',
    resumen: 'La luminosidad sube a ~600 lux.',
    porQue:
      'La radiación luminosa decolora pigmentos y acelera el envejecimiento.',
  },
  {
    tipo: 'GRUPO_VISITANTES',
    titulo: 'Grupo de visitantes',
    objetivo: 'sala',
    icono: 'visitas',
    resumen: 'Presencia continua en las 2 exhibiciones de la sala durante 2 min.',
    porQue:
      'Mide el impacto de una afluencia repentina en el ranking y la carga de visitas.',
  },
  {
    tipo: 'SENSOR_DESCONECTADO',
    titulo: 'Sensor desconectado',
    objetivo: 'sensor',
    icono: 'sensor',
    resumen: 'El sensor deja de publicar; su estado expira a los 5 min en Redis.',
    porQue:
      'Demuestra la detección de pérdida de telemetría sin afectar al resto del sistema.',
  },
]

const NOMBRE_TIPO = Object.fromEntries(ESCENARIOS.map((e) => [e.tipo, e.titulo]))

function iconoDe(nombre) {
  if (nombre === 'clima') return <IconoRayo />
  if (nombre === 'humedad') return <IconoWifi />
  if (nombre === 'luz') return <IconoRayo />
  if (nombre === 'visitas') return <IconoUsuarios />
  return <IconoAntena />
}


function mensajeDeError(error, porDefecto) {
  if (error instanceof ErrorHttp) {
    if (error.estado === 404) {
      return 'El simulador no está habilitado en el backend (APP_SIMULADOR_HABILITADO=false).'
    }
    if (error.tipo === 'conexion') {
      return 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.'
    }
    if (error.tipo === 'autorizacion') {
      return 'Tu sesión ha expirado o no tienes permisos para usar el simulador.'
    }
    return error.message || porDefecto
  }
  return porDefecto
}

function formatearRestante(seg) {
  if (seg == null || !Number.isFinite(Number(seg))) return '—'
  const total = Math.max(0, Math.round(Number(seg)))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`
}

function nombreObjetivo(objetivo, salas) {
  if (!objetivo) return '—'
  const sala = salas.find(
    (s) => s.codigo3d === objetivo || String(s.id) === String(objetivo),
  )
  if (sala) {
    const etiqueta = sala.orden != null ? sala.orden : sala.id
    return `Sala ${etiqueta} · ${sala.nombre}`
  }
  return objetivo
}

export default function Simulador({ sesion }) {
  const esSuperAdmin = (sesion?.rol || '').toUpperCase() === 'SUPERADMIN'

  const [salas, setSalas] = useState([])
  const [estado, setEstado] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [noDisponible, setNoDisponible] = useState(false)

  const [salaPorTipo, setSalaPorTipo] = useState({})
  const [sensor, setSensor] = useState('')
  const [ocupado, setOcupado] = useState(null)
  const [aviso, setAviso] = useState(null)

  const cargar = useCallback(async (signal) => {
    try {
      const datos = await obtenerEscenarios({ signal })
      setEstado(datos)
      setError(null)
      setNoDisponible(false)
    } catch (e) {
      if (e?.name === 'AbortError') return
      if (e instanceof ErrorHttp && e.estado === 404) {
        setNoDisponible(true)
        setError(null)
      } else {
        setError(mensajeDeError(e, 'No se pudo consultar el estado del simulador.'))
      }
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    const controlador = new AbortController()
    cargar(controlador.signal)
    return () => controlador.abort()
  }, [cargar])

  useEffect(() => {
    if (noDisponible) return undefined
    const controlador = new AbortController()
    const intervalo = setInterval(() => cargar(controlador.signal), REFRESCO_MS)
    return () => {
      controlador.abort()
      clearInterval(intervalo)
    }
  }, [cargar, noDisponible])

  useEffect(() => {
    const controlador = new AbortController()
    listarSalasPublicas({ signal: controlador.signal })
      .then((datos) => setSalas(Array.isArray(datos) ? datos : []))
      .catch(() => setSalas([]))
    return () => controlador.abort()
  }, [])

  const sensoresDisponibles = useMemo(() => {
    const ambientales = []
    for (let i = 1; i <= 6; i++) {
      ambientales.push({ codigo: `SENSOR-AMBIENTAL-00${i}`, etiqueta: `Ambiental ${i}` })
    }
    for (let i = 1; i <= 12; i++) {
      const n = String(i).padStart(3, '0')
      ambientales.push({ codigo: `SENSOR-PRESENCIA-${n}`, etiqueta: `Presencia ${i}` })
    }
    return ambientales
  }, [])

  const escenariosActivos = estado?.escenarios || []
  const horarioForzado = estado?.horarioForzado === true

  const salaElegida = (tipo) => {
    const valor = salaPorTipo[tipo]
    if (valor) return valor
    return salas[0]?.codigo3d || ''
  }

  // Sondea el estado unas cuantas veces tras enviar una orden: Node-RED la
  // aplica y publica el topic retenido en el siguiente ciclo (<= 5 s).
  const refrescarPronto = async () => {
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800))
      try {
        const datos = await obtenerEscenarios()
        setEstado(datos)
        const activos = datos?.escenarios?.length || 0
        const horario = datos?.horarioForzado === true
        if (i >= 1 && (activos > 0 || horario)) break
      } catch {
        // se reintenta en la siguiente vuelta
      }
    }
    await cargar()
  }

  const ejecutar = async (clave, accion) => {
    setOcupado(clave)
    setAviso(null)
    try {
      const datos = await accion()
      if (datos) setEstado(datos)
      // Node-RED procesa la orden de forma asíncrona y publica el estado
      // retenido unos segundos después; se sondea brevemente para reflejarlo.
      await refrescarPronto()
    } catch (e) {
      setAviso({ tipo: 'error', texto: mensajeDeError(e, 'No se pudo enviar la orden.') })
    } finally {
      setOcupado(null)
    }
  }

  const activar = (escenario) =>
    ejecutar(`activar:${escenario.tipo}`, () =>
      escenario.objetivo === 'sensor'
        ? activarEscenario({ tipo: escenario.tipo, sensorCodigo: sensor })
        : activarEscenario({ tipo: escenario.tipo, sala: salaElegida(escenario.tipo) }),
    )

  const restablecerActivo = (activo) =>
    ejecutar(`rest:${activo.tipo}:${activo.objetivo}`, () => {
      const esSensor = activo.objetivo && activo.objetivo.startsWith('SENSOR-')
      const esSala = activo.objetivo && activo.objetivo.startsWith('SALA_')
      return restablecerEscenarios({
        sensorCodigo: esSensor ? activo.objetivo : undefined,
        sala: esSala ? activo.objetivo : undefined,
      })
    })

  const restablecerTodo = () =>
    ejecutar('rest:todo', () => restablecerEscenarios({ todo: true }))

  const alternarHorario = () =>
    ejecutar('horario', () => cambiarHorarioForzado(!horarioForzado))

  if (!esSuperAdmin || noDisponible) {
    return null
  }

  return (
    <div className="simulador-vista">
      <header className="simulador-cabecera">
        <div className="simulador-cabecera__textos">
          <h1 className="simulador-cabecera__titulo">Simulador</h1>
          <p className="simulador-cabecera__subtitulo">
            Escenarios controlables para demostrar el monitoreo, las alertas y la popularidad.
          </p>
        </div>
        <span className="simulador-aviso-datos" role="note">
          <IconoInfo /> Datos simulados para demostración
        </span>
      </header>

      {aviso && (
        <div className={`simulador-mensaje simulador-mensaje--${aviso.tipo}`} role="alert">
          <IconoAdvertencia />
          <span>{aviso.texto}</span>
          <button type="button" className="simulador-boton-texto" onClick={() => setAviso(null)}>
            Cerrar
          </button>
        </div>
      )}

      {error && (
        <div className="simulador-mensaje simulador-mensaje--error" role="alert">
          <IconoAdvertencia />
          <span>{error}</span>
          <button type="button" className="simulador-boton" onClick={() => cargar()}>
            <IconoRecargar /> Reintentar
          </button>
        </div>
      )}

      {cargando && !estado && (
        <div className="simulador-cargando" role="status">
          <IconoReloj /> Consultando el simulador…
        </div>
      )}

      {!cargando && (
        <>
          <section className="simulador-panel">
            <header className="simulador-panel__cabecera">
              <h2 className="simulador-panel__titulo">Escenarios activos</h2>
              <div className="simulador-panel__acciones">
                <span className={`simulador-contador${escenariosActivos.length ? ' is-activo' : ''}`}>
                  {escenariosActivos.length} activo(s)
                </span>
                <button
                  type="button"
                  className="simulador-boton"
                  onClick={restablecerTodo}
                  disabled={ocupado === 'rest:todo' || escenariosActivos.length === 0}
                >
                  <IconoRecargar /> Restablecer todo
                </button>
              </div>
            </header>

            {escenariosActivos.length === 0 ? (
              <div className="simulador-vacio" role="status">
                <IconoCheck />
                <span>Sin escenarios activos. El simulador está en su comportamiento normal.</span>
              </div>
            ) : (
              <ul className="simulador-activos">
                {escenariosActivos.map((activo) => (
                  <li
                    key={`${activo.tipo}-${activo.objetivo}`}
                    className="simulador-activo"
                  >
                    <div className="simulador-activo__info">
                      <span className="simulador-activo__tipo">
                        {NOMBRE_TIPO[activo.tipo] || activo.tipo}
                      </span>
                      <span className="simulador-activo__objetivo">
                        {nombreObjetivo(activo.objetivo, salas)}
                      </span>
                    </div>
                    <span className="simulador-activo__tiempo">
                      <IconoReloj /> {formatearRestante(activo.restantesSeg)}
                    </span>
                    <button
                      type="button"
                      className="simulador-boton simulador-boton--pequeno"
                      onClick={() => restablecerActivo(activo)}
                      disabled={ocupado === `rest:${activo.tipo}:${activo.objetivo}`}
                    >
                      Restablecer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="simulador-panel">
            <header className="simulador-panel__cabecera">
              <h2 className="simulador-panel__titulo">Horario de visita</h2>
            </header>
            <div className="simulador-horario">
              <div className="simulador-horario__texto">
                <span className="simulador-horario__estado">
                  {horarioForzado ? 'Forzado (11:00)' : 'Horario real'}
                </span>
                <p className="simulador-horario__nota">
                  Fuerza al simulador a comportarse como a las 11:00, útil para demostrar
                  de noche: luz encendida y presencia de visitantes.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={horarioForzado}
                className={`simulador-switch${horarioForzado ? ' is-encendido' : ''}`}
                onClick={alternarHorario}
                disabled={ocupado === 'horario'}
              >
                <span className="simulador-switch__bola" aria-hidden="true" />
                <span className="simulador-switch__texto">
                  {horarioForzado ? 'Activado' : 'Desactivado'}
                </span>
              </button>
            </div>
          </section>

          <section className="simulador-escenarios">
            {ESCENARIOS.map((escenario) => (
              <article key={escenario.tipo} className="simulador-tarjeta">
                <header className="simulador-tarjeta__cabecera">
                  <span className="simulador-tarjeta__icono" aria-hidden="true">
                    {iconoDe(escenario.icono)}
                  </span>
                  <h3 className="simulador-tarjeta__titulo">{escenario.titulo}</h3>
                </header>

                <p className="simulador-tarjeta__resumen">{escenario.resumen}</p>
                <p className="simulador-tarjeta__porque">{escenario.porQue}</p>

                {escenario.objetivo === 'sala' ? (
                  <label className="simulador-campo">
                    <span>Sala</span>
                    <select
                      value={salaElegida(escenario.tipo)}
                      onChange={(e) =>
                        setSalaPorTipo((prev) => ({ ...prev, [escenario.tipo]: e.target.value }))
                      }
                      disabled={salas.length === 0}
                    >
                      {salas.map((s) => (
                        <option key={s.codigo3d || s.id} value={s.codigo3d || String(s.id)}>
                          Sala {s.orden ?? s.id} · {s.nombre}
                        </option>
                      ))}
                      {salas.length === 0 && <option value="">Sin salas disponibles</option>}
                    </select>
                  </label>
                ) : (
                  <label className="simulador-campo">
                    <span>Sensor</span>
                    <select value={sensor} onChange={(e) => setSensor(e.target.value)}>
                      <option value="">Selecciona un sensor…</option>
                      {sensoresDisponibles.map((s) => (
                        <option key={s.codigo} value={s.codigo}>
                          {s.etiqueta} — {s.codigo}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <button
                  type="button"
                  className="simulador-boton simulador-boton--primario"
                  onClick={() => activar(escenario)}
                  disabled={
                    ocupado === `activar:${escenario.tipo}` ||
                    (escenario.objetivo === 'sensor' ? !sensor : salas.length === 0)
                  }
                >
                  {ocupado === `activar:${escenario.tipo}` ? 'Enviando…' : 'Activar'}
                </button>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
