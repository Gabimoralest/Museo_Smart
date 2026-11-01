import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useProgress } from '@react-three/drei'

import { Box3, Euler, Vector3 } from 'three'
import {
  ALTURA_OJO,
  APARICION,
  CLAVE_EXHIBICION_ID,
  COLOR_RESALTE,
  LIMITES,
  MODELO_URL,
  RADIO_JUGADOR,
  SENSIBILIDAD,
  VELOCIDAD,
  esColision,
} from '../data/museo3d'
import { listarTodasExhibicionesPublicas } from '../data/exhibicionesPublicasApi'
import { registrarVisita, FUENTE_CURSOR } from '../data/popularidadPublicaApi'
import { primeraVista, exhibicionMostrable } from '../data/fichaExhibicion'
import { obtenerSesionAnonima } from '../data/sesionAnonima'
import FichaVisitante from './FichaVisitante'
import './RecorridoMuseo.css'

const MAX_PITCH = Math.PI / 2 - 0.08

// Altura aproximada del cuerpo del visitante. Las cajas por encima de esta cota
// (marcos superiores de puertas, dinteles) no deben bloquear el paso.
const ALTURA_CUERPO = 1.8

// Configuración estable del lienzo. Al declararla fuera del componente, R3F no
// detecta cambios en cada render y evita reconfigurar el renderizador/cámara.
const CAMARA_INICIAL = {
  position: [APARICION.x, ALTURA_OJO, APARICION.z],
  fov: 70,
  near: 0.1,
  far: 100,
}
const CONFIG_WEBGL = { antialias: true, powerPreference: 'high-performance' }
const DPR = [1, 2]

// El vidrio del museo usa KHR_materials_transmission. three renderiza la escena
// completa a un render target adicional en cada frame para simularlo; bajando la
// escala de esa transmisión se reduce a una fracción del coste sin tocar el GLB.
const ESCALA_TRANSMISION = 0.5

// Aplica esa reducción al crear el renderizador (punto previsto por R3F).
const alCrearLienzo = ({ gl }) => {
  gl.transmissionResolutionScale = ESCALA_TRANSMISION
}

// ¿La posición (x, z) del jugador está libre de colisiones arquitectónicas?
function posicionLibre(x, z, colisiones) {
  if (x < LIMITES.xMin || x > LIMITES.xMax || z < LIMITES.zMin || z > LIMITES.zMax) {
    return false
  }
  for (const caja of colisiones) {
    if (caja.max.y <= 0.2 || caja.min.y >= ALTURA_CUERPO) continue
    if (
      x > caja.min.x - RADIO_JUGADOR &&
      x < caja.max.x + RADIO_JUGADOR &&
      z > caja.min.z - RADIO_JUGADOR &&
      z < caja.max.z + RADIO_JUGADOR
    ) {
      return false
    }
  }
  return true
}

function materialesDe(malla) {
  return Array.isArray(malla.material) ? malla.material : [malla.material]
}

function aplicarResalte(malla, encendido) {
  for (const material of materialesDe(malla)) {
    if (!material || !material.emissive) continue
    const base = material.userData.emisionBase
    if (encendido) {
      material.emissive.setHex(COLOR_RESALTE)
      material.emissiveIntensity = 0.55
    } else if (base) {
      material.emissive.copy(base)
      material.emissiveIntensity = material.userData.intensidadBase ?? 1
    } else {
      material.emissive.setHex(0x000000)
      material.emissiveIntensity = 1
    }
  }
}

// Sube por la jerarquía desde una malla hasta el nodo que lleva el id de la
// exhibición (extras glTF -> userData). Devuelve null si no hay ninguno.
function idExhibicionDeAncestro(objeto) {
  for (let actual = objeto; actual; actual = actual.parent) {
    const id = actual.userData?.[CLAVE_EXHIBICION_ID]
    if (typeof id === 'string' && id.trim()) return id.trim()
  }
  return null
}

function aplicarResalteAncla(ancla, encendido) {
  for (const malla of ancla.mallas) aplicarResalte(malla, encendido)
}

// Contenido interno del <Canvas>: carga el modelo, indexa las exhibiciones
// etiquetadas en el GLB, prepara colisiones, gobierna la cámara en primera
// persona y realiza la selección.
function EscenaMuseo({
  activo,
  alSeleccionar,
  alCambiarCandidata,
  piezaSeleccionada,
  exhibicionesPorUbicacion,
}) {
  const { scene } = useGLTF(MODELO_URL)
  const { gl, camera, raycaster } = useThree()

  const grupoRef = useRef(null)
  const clon = useMemo(() => scene.clone(true), [scene])
  const inicializadoRef = useRef(false)
  const colisionesRef = useRef([])
  const anclasRef = useRef([])
  const anclasMapaRef = useRef(new Map())
  // Ubicaciones clicables = las que tienen una exhibición activa en la API.
  const clickeables = useMemo(
    () => (exhibicionesPorUbicacion ? new Set(exhibicionesPorUbicacion.keys()) : new Set()),
    [exhibicionesPorUbicacion],
  )
  const resaltadoRef = useRef(null)
  const seleccionadoRef = useRef(null)

  const teclasRef = useRef({ adelante: false, atras: false, izq: false, der: false })
  const yawRef = useRef(APARICION.rotacionY)
  const pitchRef = useRef(0)
  const eulerRef = useRef(new Euler(0, 0, 0, 'YXZ'))
  const direccionRef = useRef(new Vector3())
  const lateralRef = useRef(new Vector3())
  const impactoRef = useRef(new Vector3())

  // Preparación del modelo:
  //   1. Construye un índice ubicacionId -> ancla recorriendo la escena y
  //      leyendo `userData.exhibicion_id` (extras del GLB). Nada de nombres de
  //      nodo en duro.
  //   2. Genera colisiones para la arquitectura (por prefijo de nombre).
  //
  // No altera el GLB original: trabaja sobre un clon en memoria que comparte
  // geometría con el original (three no duplica geometría en Object3D.clone).
  //
  // Para el apuntado NO se recorren los ~900.000 triángulos del modelo en cada
  // frame; basta con la caja envolvente de cada pieza, que es una operación
  // prácticamente instantánea.
  useLayoutEffect(() => {
    const grupo = grupoRef.current
    if (!grupo) return
    grupo.updateWorldMatrix(true, true)

    const colisiones = []
    const anclas = new Map()
    // La anisotropía mejora la nitidez de texturas vistas en ángulo rasante
    // (suelo, paredes, cuadros) sin reemplazar el GLB. Se limita al máximo que
    // admite la GPU para no costar más de lo necesario.
    const maxAnisotropia = gl.capabilities?.getMaxAnisotropy?.() || 1
    const anisotropia = Math.min(8, maxAnisotropia)

    const aplicarCalidad = (material) => {
      if (!material) return
      for (const clave of Object.keys(material)) {
        const valor = material[clave]
        if (valor && valor.isTexture && valor.anisotropy !== anisotropia) {
          valor.anisotropy = anisotropia
          valor.needsUpdate = true
        }
      }
    }

    clon.traverse((objeto) => {
      // Nodo vacío de exhibición: ancla del contrato del modelo.
      const idExhibicion = objeto.userData?.[CLAVE_EXHIBICION_ID]
      if (typeof idExhibicion === 'string' && idExhibicion.trim()) {
        const ubicacionId = idExhibicion.trim()
        const existente = anclas.get(ubicacionId)
        if (existente) {
          // Duplicado: se conserva el primero y se anota para el resumen.
          existente.duplicado = true
        } else {
          anclas.set(ubicacionId, { ubicacionId, nodo: objeto, mallas: [], duplicado: false })
        }
      }

      if (!objeto.isMesh) return
      const nombre = objeto.name

      // Asocia la malla con su ancla de exhibición (subiendo por .parent).
      // Esto permite resaltar todas las mallas de una pieza conectada.
      const idAncestro = idExhibicionDeAncestro(objeto)
      if (idAncestro) {
        const ancla = anclas.get(idAncestro)
        if (ancla) {
          objeto.material = Array.isArray(objeto.material)
            ? objeto.material.map((m) => m.clone())
            : objeto.material.clone()
          for (const material of materialesDe(objeto)) {
            if (!material) continue
            material.userData.emisionBase = material.emissive
              ? material.emissive.clone()
              : null
            material.userData.intensidadBase = material.emissiveIntensity ?? 1
            aplicarCalidad(material)
          }
          ancla.mallas.push(objeto)
          return
        }
      }

      for (const material of materialesDe(objeto)) aplicarCalidad(material)

      if (esColision(nombre)) {
        colisiones.push(new Box3().setFromObject(objeto))
      }
    })

    // Caja envolvente por ancla (para el apuntado barato y el clic por caja).
    const listaAnclas = []
    for (const ancla of anclas.values()) {
      if (ancla.mallas.length === 0) continue
      const caja = new Box3()
      for (const malla of ancla.mallas) caja.union(new Box3().setFromObject(malla))
      listaAnclas.push({ ubicacionId: ancla.ubicacionId, mallas: ancla.mallas, caja, duplicado: ancla.duplicado })
    }

    colisionesRef.current = colisiones
    anclasRef.current = listaAnclas
    anclasMapaRef.current = anclas
  }, [clon, gl])

  // Resumen de desarrollo: cruza los IDs etiquetados en el modelo con el
  // catálogo de la API. Se recalcula cuando cualquiera de los dos está listo
  // (el modelo puede cargar antes o después de la respuesta del backend).
  useEffect(() => {
    if (!import.meta.env.DEV || !exhibicionesPorUbicacion) return
    const anclas = anclasMapaRef.current
    if (!anclas || anclas.size === 0) return
    const idsModelo = [...anclas.keys()]
    const activas = [...exhibicionesPorUbicacion.values()]
    const sinExhibicion = idsModelo.filter((id) => !exhibicionesPorUbicacion.has(id))
    const sinNodo = activas
      .map((ex) => ex.ubicacion3dCodigo)
      .filter((id) => id && !anclas.has(id))
    const duplicados = [...anclas.values()].filter((a) => a.duplicado).map((a) => a.ubicacionId)
    console.info('[recorrido 3D] resumen modelo/API', {
      idsModelo: idsModelo.length,
      exhibicionesActivas: activas.length,
      idsDelModeloSinExhibicion: sinExhibicion,
      exhibicionesActivasSinNodoEnModelo: sinNodo,
      idsDuplicados: duplicados,
    })
  }, [exhibicionesPorUbicacion, clon])

  // Mantiene el resalte en sincronía con la pieza seleccionada en el padre: si
  // se deselecciona (por ejemplo, al reiniciar el recorrido), se apaga.
  useEffect(() => {
    if (piezaSeleccionada) return
    if (seleccionadoRef.current) {
      aplicarResalteAncla(seleccionadoRef.current, false)
      seleccionadoRef.current = null
    }
  }, [piezaSeleccionada])

  // Posición inicial: solo la primera vez que se entra en el recorrido. No se
  // reinicia al liberar el cursor (por ejemplo, al alternar pantalla completa),
  // de modo que se conserva la posición y la orientación de la cámara.
  useLayoutEffect(() => {
    if (!activo || inicializadoRef.current) return
    inicializadoRef.current = true
    camera.position.set(APARICION.x, ALTURA_OJO, APARICION.z)
    yawRef.current = APARICION.rotacionY
    pitchRef.current = 0
  }, [activo, camera])

  // Movimiento con el ratón (solo mientras el cursor está capturado).
  useEffect(() => {
    if (!activo) return undefined
    const alMover = (evento) => {
      yawRef.current -= evento.movementX * SENSIBILIDAD
      pitchRef.current -= evento.movementY * SENSIBILIDAD
      pitchRef.current = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitchRef.current))
    }
    document.addEventListener('mousemove', alMover)
    return () => document.removeEventListener('mousemove', alMover)
  }, [activo])

  // Teclado WASD (solo mientras el cursor está capturado).
  useEffect(() => {
    if (!activo) return undefined
    const mapa = {
      KeyW: 'adelante',
      ArrowUp: 'adelante',
      KeyS: 'atras',
      ArrowDown: 'atras',
      KeyA: 'izq',
      ArrowLeft: 'izq',
      KeyD: 'der',
      ArrowRight: 'der',
    }
    const abajo = (evento) => {
      const accion = mapa[evento.code]
      if (!accion) return
      // No interceptar el teclado cuando el foco está en un campo de formulario.
      if (evento.target instanceof Element && evento.target.closest(
        'input, select, textarea, [contenteditable="true"]',
      )) {
        return
      }
      teclasRef.current[accion] = true
      evento.preventDefault()
    }
    const arriba = (evento) => {
      const accion = mapa[evento.code]
      if (!accion) return
      teclasRef.current[accion] = false
    }
    window.addEventListener('keydown', abajo)
    window.addEventListener('keyup', arriba)
    return () => {
      window.removeEventListener('keydown', abajo)
      window.removeEventListener('keyup', arriba)
      teclasRef.current = { adelante: false, atras: false, izq: false, der: false }
    }
  }, [activo])

  // Selección con clic mientras el cursor está capturado (mirando al centro).
  // El raycast preciso contra la malla (costoso) se hace solo al hacer clic,
  // nunca dentro del bucle de render.
  useEffect(() => {
    if (!activo) return undefined
    const alPulsar = (evento) => {
      if (evento.button !== 0) return
      // Un clic sobre la interfaz (botones, enlaces, controles) nunca debe
      // interpretarse como selección de una pieza.
      if (evento.target instanceof Element && evento.target.closest(
        'button, a, input, select, textarea, label, [role="button"]',
      )) {
        return
      }
      const candidato = resaltadoRef.current
      if (!candidato) return

      raycaster.setFromCamera({ x: 0, y: 0 }, camera)
      const preciso = raycaster.intersectObjects(candidato.mallas, false)

      // Si el clic coincide con la caja pero no toca la malla, se conserva la
      // selección por caja para no frustrar al visitante.
      if (preciso.length === 0 && !raycaster.ray.intersectBox(candidato.caja, impactoRef.current)) {
        return
      }

      if (seleccionadoRef.current && seleccionadoRef.current !== candidato) {
        aplicarResalteAncla(seleccionadoRef.current, false)
      }
      seleccionadoRef.current = candidato
      aplicarResalteAncla(candidato, true)
      alSeleccionar(candidato.ubicacionId)
    }
    document.addEventListener('mousedown', alPulsar)
    return () => document.removeEventListener('mousedown', alPulsar)
  }, [activo, alSeleccionar, camera, raycaster])

  // Restaura el resalte pendiente al desmontar.
  useEffect(() => {
    return () => {
      if (resaltadoRef.current) aplicarResalteAncla(resaltadoRef.current, false)
      if (seleccionadoRef.current) aplicarResalteAncla(seleccionadoRef.current, false)
    }
  }, [])

  // Al salir de la ruta se libera el modelo cacheado por drei (geometrías y
  // texturas de ~64 MB) para no retener memoria innecesaria. La purga se
  // aplaza y solo se ejecuta si el lienzo ya no está en el DOM, de modo que no
  // afecta al doble montaje de React StrictMode (que sí vuelve a montarlo).
  useEffect(() => {
    return () => {
      const id = window.setTimeout(() => {
        if (!document.querySelector('.recorrido__lienzo canvas')) {
          useGLTF.clear(MODELO_URL)
        }
      }, 0)
      return () => window.clearTimeout(id)
    }
  }, [])

  const dirTemp = useRef({ x: 0, z: 0 })

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const camara = state.camera

    eulerRef.current.set(pitchRef.current, yawRef.current, 0)
    camara.quaternion.setFromEuler(eulerRef.current)

    if (!activo) {
      if (resaltadoRef.current) {
        aplicarResalteAncla(resaltadoRef.current, false)
        resaltadoRef.current = null
        // Avisa al padre solo cuando realmente cambia (aquí, a "ninguna"):
        // así el tooltip se oculta al salir del recorrido sin re-render por frame.
        alCambiarCandidata(null)
      }
      return
    }

    const teclas = teclasRef.current
    const yaw = yawRef.current
    // Eje de avance (-Z de la cámara, horizontalizado) y eje lateral (+X).
    direccionRef.current.set(-Math.sin(yaw), 0, -Math.cos(yaw))
    lateralRef.current.set(Math.cos(yaw), 0, -Math.sin(yaw))

    dirTemp.current.x = 0
    dirTemp.current.z = 0
    if (teclas.adelante) {
      dirTemp.current.x += direccionRef.current.x
      dirTemp.current.z += direccionRef.current.z
    }
    if (teclas.atras) {
      dirTemp.current.x -= direccionRef.current.x
      dirTemp.current.z -= direccionRef.current.z
    }
    if (teclas.der) {
      dirTemp.current.x += lateralRef.current.x
      dirTemp.current.z += lateralRef.current.z
    }
    if (teclas.izq) {
      dirTemp.current.x -= lateralRef.current.x
      dirTemp.current.z -= lateralRef.current.z
    }

    const largo = Math.hypot(dirTemp.current.x, dirTemp.current.z)
    if (largo > 0) {
      const paso = (VELOCIDAD * dt) / largo
      const dx = dirTemp.current.x * paso
      const dz = dirTemp.current.z * paso
      const colisiones = colisionesRef.current
      const destinoX = camara.position.x + dx
      if (posicionLibre(destinoX, camara.position.z, colisiones)) {
        camara.position.x = destinoX
      }
      const destinoZ = camara.position.z + dz
      if (posicionLibre(camara.position.x, destinoZ, colisiones)) {
        camara.position.z = destinoZ
      }
    }

    camara.position.y = ALTURA_OJO

    // Apuntado por caja envolvente: barato y suficiente para el resalte.
    // Solo se consideran anclas que correspondan a una exhibición activa; el
    // resto del modelo no es clicable (ni se resalta).
    raycaster.setFromCamera({ x: 0, y: 0 }, camara)
    let candidato = null
    let mejorDistancia = Infinity
    for (const ancla of anclasRef.current) {
      if (!clickeables.has(ancla.ubicacionId)) continue
      if (raycaster.ray.intersectBox(ancla.caja, impactoRef.current)) {
        const distancia = impactoRef.current.distanceToSquared(camara.position)
        if (distancia < mejorDistancia) {
          mejorDistancia = distancia
          candidato = ancla
        }
      }
    }

    if (candidato !== resaltadoRef.current) {
      if (resaltadoRef.current) aplicarResalteAncla(resaltadoRef.current, false)
      resaltadoRef.current = candidato
      if (candidato) aplicarResalteAncla(candidato, true)
      // Notifica al árbol React SOLO cuando cambia la identidad de la pieza
      // candidata. Nunca se llama a setState por fotograma: si el cursor sigue
      // sobre la misma obra, este bloque no se ejecuta.
      alCambiarCandidata(candidato ? candidato.ubicacionId : null)
    }
  })

  return (
    <group ref={grupoRef}>
      <primitive object={clon} />
    </group>
  )
}

function IconoExpandir() {
  return (
    <svg
      className="recorrido__pantalla-icono"
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
    >
      <path d="M4 9V4h5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
    </svg>
  )
}

function IconoContraer() {
  return (
    <svg
      className="recorrido__pantalla-icono"
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
    >
      <path d="M9 4v5H4" />
      <path d="M15 4v5h5" />
      <path d="M9 20v-5H4" />
      <path d="M15 20v-5h5" />
    </svg>
  )
}

function Cargando({ progreso }) {
  return (
    <div className="recorrido__estado" role="status">
      <p className="recorrido__estado-titulo">Preparando el museo…</p>
      <div className="recorrido__barra">
        <span style={{ width: `${Math.round(progreso)}%` }} />
      </div>
      <p className="recorrido__estado-detalle">{Math.round(progreso)}%</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Presentación de datos de exhibición
// ---------------------------------------------------------------------------

// Vista previa compacta al pasar el cursor. No bloquea el centro: se ancla en
// una esquina y no captura el puntero (pointer-events: none).
function VistaPreviaPieza({ exhibicion }) {
  if (!exhibicionMostrable(exhibicion)) return null
  const vista = primeraVista(exhibicion)
  return (
    <div className="recorrido__previa" role="status" aria-live="polite">
      <span className="recorrido__previa-etiqueta">Obra señalada</span>
      <span className="recorrido__previa-nombre">{vista.titulo}</span>
      {vista.sala && <span className="recorrido__previa-sala">{vista.sala}</span>}
      <span className="recorrido__previa-ayuda">Haz clic para ver la ficha</span>
    </div>
  )
}


// Ficha ampliada del visitante (reemplazada por FichaVisitante reutilizable).
function FichaPieza({ exhibicion, errorDatos, onCerrar }) {
  return (
    <FichaVisitante
      exhibicion={exhibicion}
      errorDatos={errorDatos}
      onCerrar={onCerrar}
      modo="recorrido"
    />
  )
}
export default function RecorridoMuseo() {
  const contenedorRef = useRef(null)
  const marcoRef = useRef(null)
  const [activo, setActivo] = useState(false)
  const [soportado] = useState(
    () => typeof document !== 'undefined' && 'requestPointerLock' in Element.prototype,
  )
  const [pieza, setPieza] = useState(null)
  const [piezaResaltada, setPiezaResaltada] = useState(null)
  const [catalogo, setCatalogo] = useState(null)
  const [errorDatos, setErrorDatos] = useState(false)
  const { progress, active: cargando } = useProgress()

  // Índice ubicacion3dCodigo (EXH_S1_01...) -> exhibición de la API. Es la
  // única correspondencia entre el modelo y los datos: el visor lee del GLB el
  // `exhibicion_id` y busca aquí esa misma clave.
  const exhibicionesPorUbicacion = useMemo(() => {
    if (!catalogo) return null
    const indice = new Map()
    for (const ex of catalogo) {
      if (ex && ex.ubicacion3dCodigo) indice.set(ex.ubicacion3dCodigo, ex)
    }
    return indice
  }, [catalogo])

  // Carga única del catálogo público al montar el visor. Un fallo (red o
  // backend caído) no bloquea el recorrido: se descarta con un aviso discreto.
  useEffect(() => {
    const controlador = new AbortController()
    listarTodasExhibicionesPublicas({ signal: controlador.signal })
      .then((datos) => {
        if (controlador.signal.aborted) return
        setCatalogo(Array.isArray(datos) ? datos : [])
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return
        setErrorDatos(true)
      })
    return () => controlador.abort()
  }, [])

  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const [errorPantalla, setErrorPantalla] = useState(null)
  const [pantallaSoportada] = useState(
    () =>
      typeof document !== 'undefined' &&
      Boolean(document.fullscreenEnabled && document.exitFullscreen),
  )

  useEffect(() => {
    const alCambiar = () => {
      const capturado = document.pointerLockElement === contenedorRef.current
      setActivo(capturado)
    }
    document.addEventListener('pointerlockchange', alCambiar)
    document.addEventListener('pointerlockerror', alCambiar)
    return () => {
      document.removeEventListener('pointerlockchange', alCambiar)
      document.removeEventListener('pointerlockerror', alCambiar)
      // Al desmontar (salir de la ruta) se libera el cursor sí o sí.
      if (document.pointerLockElement) document.exitPointerLock()
    }
  }, [])

  // Sincroniza el estado del botón con el estado real del navegador, también
  // cuando se sale con Esc (que no dispara nuestro onClick).
  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const alCambiarPantalla = () => {
      setPantallaCompleta(document.fullscreenElement === marcoRef.current)
      setErrorPantalla(null)
    }
    const alFallarPantalla = () => {
      setErrorPantalla('No se pudo activar la pantalla completa.')
    }
    document.addEventListener('fullscreenchange', alCambiarPantalla)
    document.addEventListener('fullscreenerror', alFallarPantalla)
    return () => {
      document.removeEventListener('fullscreenchange', alCambiarPantalla)
      document.removeEventListener('fullscreenerror', alFallarPantalla)
      // Al desmontar se abandona la pantalla completa para no dejarla colgada.
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  const alternarPantallaCompleta = useCallback(() => {
    if (!pantallaSoportada || !marcoRef.current) {
      setErrorPantalla('Tu navegador no admite pantalla completa.')
      return
    }
    setErrorPantalla(null)
    const accion = document.fullscreenElement
      ? document.exitFullscreen()
      : marcoRef.current.requestFullscreen()
    if (accion && typeof accion.catch === 'function') {
      accion.catch(() => {
        setErrorPantalla('No se pudo cambiar el modo de pantalla completa.')
      })
    }
  }, [pantallaSoportada])

  // Reanuda el recorrido sin perder el estado: no reinicia la posición de la
  // cámara ni la pieza seleccionada (el estado se reinicia al desmontar la ruta).
  const iniciar = useCallback(() => {
    contenedorRef.current?.requestPointerLock()
  }, [])

  // Solo es clicable una pieza cuya ubicación esté en el catálogo de
  // exhibiciones ACTIVAS. Se usa tanto para el tooltip como para la ficha.
  const exhibicionParaUbicacion = useCallback(
    (ubicacionId) => {
      if (!ubicacionId || !exhibicionesPorUbicacion) return null
      return exhibicionesPorUbicacion.get(ubicacionId) ?? null
    },
    [exhibicionesPorUbicacion],
  )

  const alCambiarCandidata = useCallback(
    (ubicacionId) => {
      if (!ubicacionId) {
        setPiezaResaltada(null)
        return
      }
      const exhibicion = exhibicionParaUbicacion(ubicacionId)
      // Si la ubicación no corresponde a ninguna exhibición activa, no es
      // clicable: no se resalta ni se muestra vista previa.
      setPiezaResaltada(exhibicion ? { ubicacionId, exhibicion } : null)
    },
    [exhibicionParaUbicacion],
  )

  // Al hacer clic: abre la ficha con datos de la API y registra la visita.
  // El hover, el tooltip y cerrar la ficha nunca llegan aquí.
  const alSeleccionar = useCallback(
    (ubicacionId) => {
      const exhibicion = exhibicionParaUbicacion(ubicacionId)
      if (!exhibicion) return

      setPieza({ ubicacionId, exhibicion })
      // Se libera el cursor para que el visitante pueda leer y usar la ficha
      // (sus botones no son accionables con el pointer lock activo).
      if (document.pointerLockElement) document.exitPointerLock()

      registrarVisita(Number(exhibicion.id), obtenerSesionAnonima(), {
        fuente: FUENTE_CURSOR,
      }).catch(() => {
        // Silencioso a propósito: la visita es telemetría, no navegación.
      })
    },
    [exhibicionParaUbicacion],
  )

  // Cierra la ficha y reanuda el recorrido si el navegador lo permite. Como se
  // invoca desde un clic o una tecla (gesto de usuario), el pointer lock puede
  // volver a solicitarse; si el navegador lo rechaza, queda la portada para
  // reanudar manualmente. Nunca bloquea ni lanza.
  const cerrarFicha = useCallback(() => {
    setPieza(null)
    const el = contenedorRef.current
    if (el && !document.pointerLockElement && typeof el.requestPointerLock === 'function') {
      try {
        el.requestPointerLock()
      } catch {
        // El visitante siempre puede reanudar con el botón de la portada.
      }
    }
  }, [])

  // Escape cierra la ficha. Si el cursor está capturado, el navegador ya usa
  // Escape para salir del pointer lock; en ese caso no se intercepta, de modo
  // que el comportamiento actual (salir del recorrido / pantalla completa)
  // permanece intacto.
  useEffect(() => {
    if (!pieza) return undefined
    const alTeclear = (evento) => {
      if (evento.key === 'Escape' && !document.pointerLockElement) {
        cerrarFicha()
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [pieza, cerrarFicha])

  return (
    <section className="recorrido" id="recorrido" aria-labelledby="recorrido-titulo">
      <div
        className={`recorrido__marco${pantallaCompleta ? ' recorrido__marco--completa' : ''}`}
        ref={marcoRef}
      >
        <div className="recorrido__lienzo" ref={contenedorRef}>
          <Canvas
            dpr={DPR}
            camera={CAMARA_INICIAL}
            gl={CONFIG_WEBGL}
            frameloop={activo ? 'always' : 'demand'}
            onCreated={alCrearLienzo}
          >
            <color attach="background" args={['#0d1014']} />
            <ambientLight intensity={0.55} />
            <hemisphereLight intensity={0.35} groundColor="#20242c" color="#c9d4e4" />
            <directionalLight position={[6, 9, 4]} intensity={1.1} />
            <directionalLight position={[-6, 7, -4]} intensity={0.5} />
            <Suspense fallback={null}>
              <EscenaMuseo
                activo={activo}
                alSeleccionar={alSeleccionar}
                alCambiarCandidata={alCambiarCandidata}
                piezaSeleccionada={pieza}
                exhibicionesPorUbicacion={exhibicionesPorUbicacion}
              />
            </Suspense>
          </Canvas>

          {activo && (
            <>
              <div className="recorrido__mira" aria-hidden="true" />
              <div className="recorrido__ayuda">
                <span>WASD para moverte</span>
                <span>Ratón para mirar</span>
                <span>Clic para seleccionar</span>
                <span>Esc para salir</span>
              </div>

              {/* Vista previa al pasar el cursor: solo si NO hay ficha abierta. */}
              {!pieza && piezaResaltada && (
                <VistaPreviaPieza exhibicion={piezaResaltada.exhibicion} />
              )}
            </>
          )}

          {/* Ficha ampliada: vive fuera del bloque `activo` porque al abrirla se
              libera el cursor (activo pasa a false) y debe seguir visible hasta
              que el visitante la cierre. */}
          {pieza && (
            <FichaPieza
              exhibicion={pieza.exhibicion}
              errorDatos={errorDatos}
              onCerrar={cerrarFicha}
            />
          )}

          {!activo && !pieza && (
            <div className="recorrido__portada">
              {cargando && progress < 100 ? (
                <Cargando progreso={progress} />
              ) : (
                <>
                  <p className="recorrido__portada-titulo">Visita guiada 3D</p>
                  <p className="recorrido__portada-texto">
                    {soportado
                      ? 'Pulsa comenzar, mueve el ratón para mirar y usa W, A, S y D para caminar. Sal con Esc cuando quieras.'
                      : 'Tu navegador no permite capturar el cursor. Puedes ver el museo, pero el recorrido en primera persona no está disponible.'}
                  </p>
                  {soportado && (
                    <button type="button" className="recorrido__boton" onClick={iniciar}>
                      Comenzar recorrido
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="recorrido__controles">
          {errorPantalla && (
            <p className="recorrido__controles-aviso" role="alert">
              {errorPantalla}
            </p>
          )}
          <button
            type="button"
            className="recorrido__pantalla"
            onClick={alternarPantallaCompleta}
            aria-pressed={pantallaCompleta}
            disabled={!pantallaSoportada}
            title={
              pantallaSoportada
                ? undefined
                : 'Tu navegador no admite pantalla completa'
            }
          >
            {pantallaCompleta ? <IconoContraer /> : <IconoExpandir />}
            <span>
              {pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}
