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

import {
  Box3,
  DoubleSide,
  Euler,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Vector3,
} from 'three'
import {
  ACELERACION,
  ALTURA_OJO,
  APARICION_PROVISIONAL,
  CLAVE_EXHIBICION_ID,
  COLOR_RESALTE,
  FRENADO,
  INTERVALO_HOVER,
  MODELO_URL,
  PASO_RUEDA,
  PERMANENCIA_FICHA,
  SENSIBILIDAD,
  SENSIBILIDAD_ARRASTRE,
  VELOCIDAD,
  VELOCIDAD_AUTO,
  VELOCIDAD_CORRER,
  VELOCIDAD_PERMANENCIA,
  calcularAcercamiento,
  calcularAparicion,
  calcularLimites,
} from '../data/museo3d'
import {
  crearAyudasDebug,
  crearDetector,
  liberarColisiones,
  prepararColisiones,
} from '../data/colisiones3d'
import {
  aplicarDesplazamiento,
  avanzarRuta,
  cancelarTransicion,
  crearTransicion,
  iniciarRuta,
  iniciarTransicion,
  interpolarAngulo,
  objetivoActual,
  suavizarVelocidad,
  terminarTransicion,
} from '../data/movimiento3d'
import { buscarRuta } from '../data/ruta3d'
import { calcularSalas, ordenarPiezas } from '../data/salas3d'
import {
  actualizarVegetacion,
  prepararVegetacion,
  restaurarVegetacion,
} from '../data/vegetacion3d'
import { listarTodasExhibicionesPublicas } from '../data/exhibicionesPublicasApi'
import { registrarVisita, FUENTE_CURSOR } from '../data/popularidadPublicaApi'
import { obtenerSesionAnonima } from '../data/sesionAnonima'
import FichaVisitante from './FichaVisitante'
import './RecorridoMuseo.css'

const MAX_PITCH = Math.PI / 2 - 0.08

// Clave de localStorage que recuerda si el visitante ya vio la ayuda.
const CLAVE_AYUDA = 'museo:recorrido-ayuda-vista'

// Nombres de los nodos que se consideran "piso" para el clic de caminar.
const PISO = /^(Piso_|Suelo_|Plataforma_)/

// Configuración estable del lienzo. Al declararla fuera del componente, R3F no
// detecta cambios en cada render y evita reconfigurar el renderizador/cámara.
// La posición real se calcula al cargar el modelo (ver `calcularAparicion`).
const CAMARA_INICIAL = {
  position: [APARICION_PROVISIONAL.x, ALTURA_OJO, APARICION_PROVISIONAL.z],
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

// ¿El visitante pidió el modo de depuración con ?debug=colisiones? Se admiten
// las dos formas habituales: en la query real (`/?debug=colisiones#/…`) y dentro
// del hash (`#/recorrido-virtual?debug=colisiones`).
function depuracionActiva() {
  if (typeof window === 'undefined') return false
  const enQuery = new URLSearchParams(window.location.search).get('debug')
  const hash = window.location.hash || ''
  const indice = hash.indexOf('?')
  const enHash = indice >= 0 ? new URLSearchParams(hash.slice(indice + 1)).get('debug') : null
  return enQuery === 'colisiones' || enHash === 'colisiones'
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
  explorando,
  alSeleccionar,
  alPermanencia,
  alRegistrarNavegacion,
  accionesRef,
  joystickRef,
  fichaCerradaRef,
  alFichaPorPermanencia,
  piezaSeleccionada,
  exhibicionesPorUbicacion,
}) {
  const { scene } = useGLTF(MODELO_URL)
  const { gl, camera, raycaster, invalidate } = useThree()

  const grupoRef = useRef(null)
  const clon = useMemo(() => scene.clone(true), [scene])
  const inicializadoRef = useRef(false)
  const detectorRef = useRef(null)
  const limitesRef = useRef(null)
  const aparicionRef = useRef({ ...APARICION_PROVISIONAL })
  const preparacionRef = useRef(null)
  const anclasRef = useRef([])
  const anclasMapaRef = useRef(new Map())
  const pisosRef = useRef([])
  const salasRef = useRef([])
  const ordenRef = useRef([])
  const plantasRef = useRef([])
  const vegetacionEstadoRef = useRef({ ultimo: 0 })
  // Ubicaciones clicables = las que tienen una exhibición activa en la API.
  const clickeables = useMemo(
    () => (exhibicionesPorUbicacion ? new Set(exhibicionesPorUbicacion.keys()) : new Set()),
    [exhibicionesPorUbicacion],
  )
  const resaltadoRef = useRef(null)
  const seleccionadoRef = useRef(null)

  const teclasRef = useRef({ adelante: false, atras: false, izq: false, der: false })
  const correrRef = useRef(false)
  const velocidadRef = useRef({ vx: 0, vz: 0 })
  const transicionRef = useRef(crearTransicion())
  const yawRef = useRef(APARICION_PROVISIONAL.rotacionY)
  const pitchRef = useRef(0)
  const eulerRef = useRef(new Euler(0, 0, 0, 'YXZ'))
  const direccionRef = useRef(new Vector3())
  const lateralRef = useRef(new Vector3())
  const impactoRef = useRef(new Vector3())

  // Interacción con puntero: arrastre, hover y clic.
  const arrastreRef = useRef({ activo: false, movido: false, x: 0, y: 0 })
  const hoverRef = useRef({ id: null, ultimo: 0 })
  const clicPendienteRef = useRef(null)
  const marcadorTimerRef = useRef(null)

  // Activación por permanencia: tiempo acumulado sobre la pieza actual. Se
  // reinicia al cambiar de pieza, al salir de ella o al moverse.
  const permanenciaRef = useRef({
    id: null,
    tiempo: 0,
    posicion: { x: 0, y: 0 },
    abierta: false,
    bloqueada: null,
  })

  // Marcador del punto al que se camina. Se crea una sola vez de forma
  // imperativa (no participa del render de React) y se reutiliza.
  const marcadorRef = useRef(null)
  useLayoutEffect(() => {
    const anillo = new Mesh(
      new RingGeometry(0.18, 0.28, 32),
      new MeshBasicMaterial({
        color: COLOR_RESALTE,
        transparent: true,
        opacity: 0.85,
        side: DoubleSide,
        depthWrite: false,
      }),
    )
    anillo.rotation.x = -Math.PI / 2
    anillo.position.y = 0.03
    anillo.visible = false
    anillo.name = 'marcador_destino'
    marcadorRef.current = anillo
    const grupo = grupoRef.current
    if (grupo) grupo.add(anillo)
    return () => {
      if (grupo) grupo.remove(anillo)
      anillo.geometry.dispose()
      anillo.material.dispose()
      marcadorRef.current = null
    }
  }, [])

  // Estado del modo de depuración (?debug=colisiones). Se decide una vez al
  // montar; el grupo de ayudas solo existe si está activo.
  const modoDebug = useMemo(() => depuracionActiva(), [])
  const debugRef = useRef({ activo: modoDebug, avisos: new Map(), ultimoPos: 0 })

  // Preparación del modelo:
  //   1. Construye un índice ubicacionId -> ancla recorriendo la escena y
  //      leyendo `userData.exhibicion_id` (extras del GLB). Nada de nombres de
  //      nodo en duro.
  //   2. Calcula límites y aparición a partir de la geometría de la fachada.
  //   3. Prepara las colisiones precisas con BVH (o COL_* si existen).
  //
  // No altera el GLB original: trabaja sobre un clon en memoria que comparte
  // geometría con el original (three no duplica geometría en Object3D.clone).
  useLayoutEffect(() => {
    const grupo = grupoRef.current
    if (!grupo) return
    grupo.updateWorldMatrix(true, true)

    const anclas = new Map()
    const pisos = []
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

      if (!objeto.isMesh || objeto.isInstancedMesh) return

      if (PISO.test(objeto.name)) pisos.push(objeto)

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
    })

    // Caja envolvente por ancla (para el apuntado barato y el clic por caja).
    const listaAnclas = []
    for (const ancla of anclas.values()) {
      if (ancla.mallas.length === 0) continue
      const caja = new Box3()
      for (const malla of ancla.mallas) caja.union(new Box3().setFromObject(malla))
      listaAnclas.push({ ubicacionId: ancla.ubicacionId, mallas: ancla.mallas, caja, duplicado: ancla.duplicado })
    }

    // Límites y aparición derivados de la geometría real del modelo.
    limitesRef.current = calcularLimites(clon)
    aparicionRef.current = calcularAparicion(clon)

    // Colisiones precisas contra la geometría (BVH) de las mallas válidas.
    preparacionRef.current = prepararColisiones(clon)
    detectorRef.current = crearDetector(preparacionRef.current.proxies)
    if (import.meta.env.DEV) {
      const { modo, mallas, proxies, puertas } = preparacionRef.current
      console.info('[recorrido 3D] colisiones', {
        modo,
        mallas: mallas.length,
        proxies: proxies.length,
        puertas,
        limites: limitesRef.current,
        aparicion: aparicionRef.current,
      })
    }

    anclasRef.current = listaAnclas
    anclasMapaRef.current = anclas
    pisosRef.current = pisos

    // Destinos de "Ir a sala" y orden del recorrido guiado, derivados del
    // modelo (SALA_N / Piso_SalaN / anclas) y del contrato de IDs.
    salasRef.current = calcularSalas(clon, listaAnclas)
    ordenRef.current = ordenarPiezas(listaAnclas)
    if (alRegistrarNavegacion) {
      alRegistrarNavegacion({
        salas: salasRef.current,
        orden: ordenRef.current,
      })
    }
    if (import.meta.env.DEV) {
      console.info('[recorrido 3D] navegación', {
        salas: salasRef.current.map((s) => `${s.etiqueta} (${s.fuente})`),
        piezasOrdenadas: ordenRef.current.length,
      })
    }

    // Vegetación: recorte solo visual (ninguna instancia colisiona).
    plantasRef.current = prepararVegetacion(clon)
    if (import.meta.env.DEV) {
      const total = plantasRef.current.reduce((suma, p) => suma + p.total, 0)
      const visibles = plantasRef.current.reduce((suma, p) => suma + p.visibles, 0)
      console.info('[recorrido 3D] vegetación', {
        mallas: plantasRef.current.length,
        instanciasTotales: total,
        instanciasVisibles: visibles,
      })
    }

    return () => {
      restaurarVegetacion(plantasRef.current)
      plantasRef.current = []
      liberarColisiones(preparacionRef.current)
      preparacionRef.current = null
      detectorRef.current = null
    }
  }, [clon, gl, alRegistrarNavegacion])


  // Encuadra la portada frente a la puerta en cuanto se conoce la geometría, y
  // deja la cámara lista para el primer fotograma. `invalidate` fuerza un
  // repintado aunque el lienzo esté en modo `demand`.
  useLayoutEffect(() => {
    if (inicializadoRef.current) return
    const aparicion = aparicionRef.current
    camera.position.set(aparicion.x, ALTURA_OJO, aparicion.z)
    yawRef.current = aparicion.rotacionY
    eulerRef.current.set(0, aparicion.rotacionY, 0)
    camera.quaternion.setFromEuler(eulerRef.current)
    invalidate()
  }, [camera, clon, invalidate])

  // Garantiza que el lienzo 3D se reencuadre y repinte al girar el dispositivo
  // o cambiar el tamaño de la ventana (incluso en la portada con frameloop="demand").
  useEffect(() => {
    let temporizador = null
    const alRedimensionar = () => {
      invalidate()
      if (temporizador) window.clearTimeout(temporizador)
      temporizador = window.setTimeout(() => {
        invalidate()
      }, 140)
    }
    window.addEventListener('resize', alRedimensionar)
    window.addEventListener('orientationchange', alRedimensionar)
    return () => {
      window.removeEventListener('resize', alRedimensionar)
      window.removeEventListener('orientationchange', alRedimensionar)
      if (temporizador) window.clearTimeout(temporizador)
    }
  }, [invalidate])

  // Informa por consola del objeto que bloquea, como máximo una vez por objeto
  // y segundo, para no inundar la consola mientras se camina pegado a una pared.
  const registrarBloqueo = useCallback((malla) => {
    if (!debugRef.current.activo) return
    const nombre = malla?.name || '(sin nombre)'
    const ahora = performance.now()
    const avisos = debugRef.current.avisos
    if (ahora - (avisos.get(nombre) ?? -Infinity) < 1000) return
    avisos.set(nombre, ahora)
    console.info(`[recorrido 3D debug] bloquea: ${nombre}`)
  }, [])

  // Modo de depuración (?debug=colisiones): dibuja en wireframe las mallas que
  // se usan para colisionar, compartiendo su geometría real.
  const debugGrupoRef = useRef(null)
  useLayoutEffect(() => {
    const activoDebug = modoDebug
    debugRef.current.activo = activoDebug
    const contenedor = debugGrupoRef.current
    if (!activoDebug || !contenedor) return undefined
    const preparacion = preparacionRef.current
    if (!preparacion) return undefined

    const { material, objetos } = crearAyudasDebug(preparacion.proxies)
    for (const objeto of objetos) contenedor.add(objeto)
    console.info('[recorrido 3D debug] colisiones dibujadas', {
      mallas: objetos.length,
      modo: preparacion.modo,
      puertas: preparacion.puertas,
    })
    invalidate()
    return () => {
      for (const objeto of objetos) contenedor.remove(objeto)
      material.dispose()
      invalidate()
    }
  }, [clon, modoDebug, invalidate])

  // Resumen de desarrollo: cruza los IDs etiquetados en el modelo con el
  // catálogo de la API.
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

  // Mantiene el resalte en sincronía con la pieza seleccionada en el padre.
  useEffect(() => {
    if (piezaSeleccionada) {
      const ancla = anclasRef.current.find((a) => a.ubicacionId === piezaSeleccionada.ubicacionId)
      if (ancla) {
        if (seleccionadoRef.current && seleccionadoRef.current !== ancla) {
          aplicarResalteAncla(seleccionadoRef.current, false)
        }
        aplicarResalteAncla(ancla, true)
        seleccionadoRef.current = ancla
      }
      return
    }
    if (seleccionadoRef.current) {
      aplicarResalteAncla(seleccionadoRef.current, false)
      seleccionadoRef.current = null
    }
  }, [piezaSeleccionada])

  // Posición inicial: solo la primera vez que se entra en el recorrido.
  useLayoutEffect(() => {
    if (!explorando || inicializadoRef.current) return
    inicializadoRef.current = true
    const aparicion = aparicionRef.current
    camera.position.set(aparicion.x, ALTURA_OJO, aparicion.z)
    yawRef.current = aparicion.rotacionY
    pitchRef.current = 0
  }, [explorando, camera])

  // Giro con el ratón en modo inmersivo (pointer lock). Usa movementX/Y.
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

  // Teclado: WASD y flechas, más Shift para correr.
  useEffect(() => {
    if (!explorando && !activo) return undefined
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
      if (evento.code === 'ShiftLeft' || evento.code === 'ShiftRight') {
        correrRef.current = true
        return
      }
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
      if (evento.code === 'ShiftLeft' || evento.code === 'ShiftRight') {
        correrRef.current = false
        return
      }
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
      correrRef.current = false
    }
  }, [explorando, activo])

  // -------------------------------------------------------------------------
  // Puntero: arrastrar para mirar, clic en el piso para caminar y doble clic
  // para acercarse. Todo el movimiento pasa por el detector de colisiones.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!explorando) return undefined
    const el = gl.domElement

    const ndcDesde = (clientX, clientY) => {
      const rect = el.getBoundingClientRect()
      return {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1,
        localX: clientX - rect.left,
        localY: clientY - rect.top,
        ancho: rect.width,
        alto: rect.height,
      }
    }

    const anclaBajoRayo = (coords) => {
      raycaster.setFromCamera(coords, camera)
      let mejor = null
      let mejorDistancia = Infinity
      for (const ancla of anclasRef.current) {
        if (!clickeables.has(ancla.ubicacionId)) continue
        if (raycaster.ray.intersectBox(ancla.caja, impactoRef.current)) {
          const distancia = impactoRef.current.distanceToSquared(raycaster.ray.origin)
          if (distancia < mejorDistancia) {
            mejorDistancia = distancia
            mejor = ancla
          }
        }
      }
      if (!mejor) return null
      // Comprobación precisa contra la malla; si el rayo pasa cerca de la caja
      // pero no toca la pieza, no se considera apuntada.
      const precisos = raycaster.intersectObjects(mejor.mallas, false)
      return precisos.length > 0 ? mejor : null
    }

    const pisoBajoRayo = (coords) => {
      if (pisosRef.current.length === 0) return null
      raycaster.setFromCamera(coords, camera)
      const impactos = raycaster.intersectObjects(pisosRef.current, false)
      return impactos.length > 0 ? impactos[0].point : null
    }

    const resaltar = (ancla) => {
      if (resaltadoRef.current === ancla) return
      if (resaltadoRef.current && resaltadoRef.current !== seleccionadoRef.current) {
        aplicarResalteAncla(resaltadoRef.current, false)
      }
      resaltadoRef.current = ancla
      if (ancla && ancla !== seleccionadoRef.current) aplicarResalteAncla(ancla, true)
    }

    // Reinicia el temporizador al cambiar de pieza o al salir de ella. Si se
    // abandona la pieza que el visitante acaba de cerrar, se libera el bloqueo
    // de reapertura (basta con salir y volver a entrar).
    const fijarPiezaApuntada = (ancla, localX, localY) => {
      const p = permanenciaRef.current
      const id = ancla ? ancla.ubicacionId : null
      resaltar(ancla)
      if (id) {
        p.posicion.x = localX
        p.posicion.y = localY
      }
      if (id === p.id) return
      p.id = id
      p.tiempo = 0
      p.informado = 0
      p.abierta = false
      const cerrada = fichaCerradaRef?.current || null
      if (cerrada && id !== cerrada) fichaCerradaRef.current = null
      hoverRef.current.id = id
      // Muestra el círculo desde el primer instante (progreso 0) y lo oculta al
      // salir de la pieza.
      alPermanencia(id ? { ubicacionId: id, x: p.posicion.x, y: p.posicion.y, progreso: 0 } : null)
    }

    const actualizarHover = (coords) => {
      const ahora = performance.now()
      if (ahora - hoverRef.current.ultimo < INTERVALO_HOVER * 1000) return
      hoverRef.current.ultimo = ahora
      const ancla = anclaBajoRayo(coords)
      fijarPiezaApuntada(ancla, coords.localX, coords.localY)
    }

    const limpiarHover = () => {
      permanenciaRef.current.id = null
      permanenciaRef.current.tiempo = 0
      permanenciaRef.current.informado = 0
      permanenciaRef.current.abierta = false
      hoverRef.current.id = null
      resaltar(null)
      alPermanencia(null)
    }

    const caminarHasta = (punto) => {
      iniciarTransicion(transicionRef.current, { x: punto.x, z: punto.z }, {
        duracionMax: 12,
        fijarYaw: false,
      })
      // El marcador se apoya en la altura real del piso pulsado (las salas
      // están elevadas ~0,75 m respecto al exterior).
      if (marcadorRef.current) marcadorRef.current.position.set(punto.x, punto.y + 0.04, punto.z)
      if (marcadorRef.current) marcadorRef.current.visible = true
      if (marcadorTimerRef.current) window.clearTimeout(marcadorTimerRef.current)
      marcadorTimerRef.current = window.setTimeout(() => {
        if (marcadorRef.current) marcadorRef.current.visible = false
        invalidate()
      }, 2500)
      invalidate()
    }

    const acercarA = (ancla) => {
      const destino = calcularAcercamiento(ancla.caja, camera.position)
      if (!destino) return
      iniciarTransicion(transicionRef.current, destino, {
        duracionMax: 3,
        fijarYaw: true,
        alLlegar: () => alSeleccionar(ancla.ubicacionId),
      })
    }

    const programarSeleccion = (ubicacionId) => {
      if (clicPendienteRef.current) window.clearTimeout(clicPendienteRef.current)
      clicPendienteRef.current = window.setTimeout(() => {
        clicPendienteRef.current = null
        alSeleccionar(ubicacionId)
      }, 220)
    }

    const alBajar = (evento) => {
      if (evento.button !== 0) return
      if (evento.target instanceof Element && evento.target.closest(
        'button, a, input, select, textarea, label, [role="button"]',
      )) {
        return
      }
      // Un segundo clic seguido cancela la selección pendiente del primero: así
      // un doble clic no abre la ficha antes de acercarse.
      if (clicPendienteRef.current) {
        window.clearTimeout(clicPendienteRef.current)
        clicPendienteRef.current = null
      }
      arrastreRef.current = { activo: true, movido: false, x: evento.clientX, y: evento.clientY }
      cancelarTransicion(transicionRef.current)
      if (activo) return
      try {
        el.setPointerCapture(evento.pointerId)
      } catch {
        // Algunos navegadores no permiten capturar; el arrastre igual funciona.
      }
    }

    const alMoverPuntero = (evento) => {
      // En modo inmersivo la mirada la gobierna movementX/Y (ver el efecto de
      // `mousemove`), así que aquí no se aplica arrastre ni hover de puntero.
      if (activo) return
      const arrastre = arrastreRef.current
      if (arrastre.activo) {
        const dx = evento.movementX ?? evento.clientX - arrastre.x
        const dy = evento.movementY ?? evento.clientY - arrastre.y
        if (Math.abs(evento.clientX - arrastre.x) + Math.abs(evento.clientY - arrastre.y) > 3) {
          arrastre.movido = true
        }
        yawRef.current -= dx * SENSIBILIDAD_ARRASTRE
        pitchRef.current -= dy * SENSIBILIDAD_ARRASTRE
        pitchRef.current = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitchRef.current))
        arrastre.x = evento.clientX
        arrastre.y = evento.clientY
        return
      }
      const coords = ndcDesde(evento.clientX, evento.clientY)
      actualizarHover(coords)
    }

    const alSubir = (evento) => {
      const arrastre = arrastreRef.current
      if (!arrastre.activo) return
      arrastre.activo = false
      try {
        el.releasePointerCapture(evento.pointerId)
      } catch {
        // Ignorado: la captura pudo no haberse concedido.
      }
      // En inmersivo, clic = lo que apunta la mira central.
      const coords = activo
        ? { x: 0, y: 0, localX: evento.clientX, localY: evento.clientY }
        : ndcDesde(evento.clientX, evento.clientY)
      if (!activo && arrastre.movido) return

      const ancla = anclaBajoRayo(coords)

      // En táctil NO aplica la activación por permanencia: se mantiene el
      // comportamiento de siempre (tocar una obra abre su ficha).
      const esTactil = evento.pointerType === 'touch'
      if (esTactil) {
        if (ancla) programarSeleccion(ancla.ubicacionId)
        else limpiarHover()
        return
      }

      if (ancla) {
        programarSeleccion(ancla.ubicacionId)
        return
      }
      if (activo) return
      const punto = pisoBajoRayo(coords)
      if (punto) caminarHasta(punto)
    }

    const alDobleClic = (evento) => {
      if (clicPendienteRef.current) {
        window.clearTimeout(clicPendienteRef.current)
        clicPendienteRef.current = null
      }
      const coords = activo
        ? { x: 0, y: 0 }
        : ndcDesde(evento.clientX, evento.clientY)
      const ancla = anclaBajoRayo(coords)
      if (ancla) acercarA(ancla)
    }

    const alRueda = (evento) => {
      if (evento.target instanceof Element && evento.target.closest(
        'button, a, input, select, textarea, label, [role="button"]',
      )) {
        return
      }
      evento.preventDefault()
      cancelarTransicion(transicionRef.current)
      const paso = -Math.sign(evento.deltaY) * PASO_RUEDA
      if (paso === 0) return
      // Rueda: avance/retroceso horizontal en la dirección de la mirada, con
      // colisiones. Se reparte en varios pasos para no atravesar paredes si la
      // rueda entrega un delta grande de golpe.
      const yaw = yawRef.current
      const dx = -Math.sin(yaw) * paso
      const dz = -Math.cos(yaw) * paso
      const tramos = Math.max(1, Math.ceil(Math.abs(paso) / 0.15))
      for (let i = 0; i < tramos; i += 1) {
        const bloqueado = aplicarDesplazamiento(
          camera.position,
          dx / tramos,
          dz / tramos,
          detectorRef.current,
          limitesRef.current,
          registrarBloqueo,
        )
        if (bloqueado) break
      }
      invalidate()
    }

    const alSalir = () => {
      if (!arrastreRef.current.activo) limpiarHover()
    }

    const alCancelar = () => {
      arrastreRef.current.activo = false
      limpiarHover()
    }

    el.addEventListener('pointerdown', alBajar)
    el.addEventListener('pointermove', alMoverPuntero)
    el.addEventListener('pointerup', alSubir)
    el.addEventListener('pointerleave', alSalir)
    el.addEventListener('pointercancel', alCancelar)
    el.addEventListener('dblclick', alDobleClic)
    el.addEventListener('wheel', alRueda, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', alBajar)
      el.removeEventListener('pointermove', alMoverPuntero)
      el.removeEventListener('pointerup', alSubir)
      el.removeEventListener('pointerleave', alSalir)
      el.removeEventListener('pointercancel', alCancelar)
      el.removeEventListener('dblclick', alDobleClic)
      el.removeEventListener('wheel', alRueda)
      if (clicPendienteRef.current) window.clearTimeout(clicPendienteRef.current)
      if (marcadorTimerRef.current) window.clearTimeout(marcadorTimerRef.current)
      clicPendienteRef.current = null
      marcadorTimerRef.current = null
    }
  }, [explorando, activo, alPermanencia, alSeleccionar, camera, clickeables, fichaCerradaRef, gl, invalidate, raycaster, registrarBloqueo])

  // Acciones de navegación pedidas desde la UI (Ir a sala / Anterior /
  // Siguiente). La escena las publica en `accionesRef` para que el padre las
  // invoque directamente, sin sondeo ni re-render por fotograma.
  useEffect(() => {
    if (!accionesRef) return undefined

    const irASala = (clave) => {
      const sala = salasRef.current.find((s) => s.clave === clave)
      if (!sala) return
      const ruta = buscarRuta({
        inicio: camera.position,
        destino: sala.destino,
        detector: detectorRef.current,
        limites: limitesRef.current,
      })
      if (ruta) {
        // El último punto de la ruta no trae orientación: se le añade la de la
        // sala para que la cámara termine mirando hacia dentro.
        const camino = ruta.map((p, i) => (
          i === ruta.length - 1 ? { ...p, ...sala.destino } : p
        ))
        iniciarRuta(transicionRef.current, camino, { duracionMax: 40, duracionMin: 0.5 })
      } else {
        iniciarTransicion(transicionRef.current, sala.destino, {
          duracionMax: 30,
          duracionMin: 0.8,
          fijarYaw: true,
        })
      }
      if (marcadorRef.current) marcadorRef.current.visible = false
      invalidate()
    }

    const irAExhibicion = (ubicacionId) => {
      const ancla = anclasRef.current.find((a) => a.ubicacionId === ubicacionId)
      if (!ancla) return
      const destino = calcularAcercamiento(ancla.caja, camera.position)
      if (!destino) return
      const ruta = buscarRuta({
        inicio: camera.position,
        destino,
        detector: detectorRef.current,
        limites: limitesRef.current,
      })
      const alLlegar = () => alSeleccionar(ubicacionId)
      if (ruta) {
        const camino = ruta.map((p, i) => (
          i === ruta.length - 1 ? { ...p, ...destino } : p
        ))
        iniciarRuta(transicionRef.current, camino, { alLlegar, duracionMax: 40, duracionMin: 0.5 })
      } else {
        iniciarTransicion(transicionRef.current, destino, {
          duracionMax: 3,
          fijarYaw: true,
          alLlegar,
        })
      }
      if (marcadorRef.current) marcadorRef.current.visible = false
      invalidate()
    }

    // Sale del recorrido: detiene movimiento y transiciones, limpia el apuntado
    // y devuelve la cámara al punto de aparición para la próxima entrada.
    const reiniciar = () => {
      cancelarTransicion(transicionRef.current)
      velocidadRef.current.vx = 0
      velocidadRef.current.vz = 0
      if (clicPendienteRef.current) {
        window.clearTimeout(clicPendienteRef.current)
        clicPendienteRef.current = null
      }
      hoverRef.current.id = null
      if (resaltadoRef.current && resaltadoRef.current !== seleccionadoRef.current) {
        aplicarResalteAncla(resaltadoRef.current, false)
      }
      resaltadoRef.current = null
      if (marcadorRef.current) marcadorRef.current.visible = false
      if (joystickRef) joystickRef.current = { x: 0, y: 0 }

      const aparicion = aparicionRef.current
      camera.position.set(aparicion.x, ALTURA_OJO, aparicion.z)
      yawRef.current = aparicion.rotacionY
      pitchRef.current = 0
      eulerRef.current.set(0, aparicion.rotacionY, 0)
      camera.quaternion.setFromEuler(eulerRef.current)
      alPermanencia(null)
      invalidate()
    }

    accionesRef.current = { irASala, irAExhibicion, salir: reiniciar }
    return () => {
      accionesRef.current = null
    }
  }, [accionesRef, alPermanencia, alSeleccionar, camera, invalidate, joystickRef])

  // Al cerrar la ficha se olvida el hover previo: en táctil, el toque que abrió
  // la ficha deja la tarjeta "activa" y el siguiente toque debe volver a mostrar
  // la tarjeta antes de abrirla de nuevo.
  useEffect(() => {
    if (!piezaSeleccionada) {
      hoverRef.current.id = null
      if (resaltadoRef.current && resaltadoRef.current !== seleccionadoRef.current) {
        aplicarResalteAncla(resaltadoRef.current, false)
        resaltadoRef.current = null
      }
    }
  }, [piezaSeleccionada])

  // Restaura los resaltes pendientes al desmontar.
  useEffect(() => {
    return () => {
      if (resaltadoRef.current) aplicarResalteAncla(resaltadoRef.current, false)
      if (seleccionadoRef.current) aplicarResalteAncla(seleccionadoRef.current, false)
    }
  }, [])

  // Al salir de la ruta se libera el modelo cacheado por drei para no retener
  // memoria innecesaria (respetando el doble montaje de StrictMode).
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

    const enMarcha = explorando || activo
    if (!enMarcha) {
      velocidadRef.current.vx = 0
      velocidadRef.current.vz = 0
      if (resaltadoRef.current) {
        aplicarResalteAncla(resaltadoRef.current, false)
        resaltadoRef.current = null
        alPermanencia(null)
      }
      return
    }

    // Con una ficha abierta no se camina, pero se sigue apuntando: si el cursor
    // permanece sobre otra obra, su ficha reemplaza a la actual.
    const movimientoBloqueado = Boolean(piezaSeleccionada)
    if (movimientoBloqueado) {
      velocidadRef.current.vx = 0
      velocidadRef.current.vz = 0
    }

    const detector = detectorRef.current
    const limites = limitesRef.current
    const transicion = transicionRef.current

    if (!movimientoBloqueado && transicion.activa && transicion.destino) {
      // Transición automática: se avanza hacia el objetivo actual (punto
      // intermedio de una ruta o destino final) respetando paredes.
      const objetivo = objetivoActual(transicion)
      const dx = objetivo.x - camara.position.x
      const dz = objetivo.z - camara.position.z
      const distancia = Math.hypot(dx, dz)
      const paso = VELOCIDAD_AUTO * dt
      let llegada = false

      if (distancia <= paso + 1e-3) {
        aplicarDesplazamiento(camara.position, dx, dz, detector, limites, registrarBloqueo)
        llegada = true
      } else {
        const bloqueado = aplicarDesplazamiento(
          camara.position,
          (dx / distancia) * paso,
          (dz / distancia) * paso,
          detector,
          limites,
          registrarBloqueo,
        )
        if (bloqueado) llegada = true
      }

      // Al alcanzar un punto intermedio se pasa al siguiente sin terminar.
      if (llegada && avanzarRuta(transicion)) llegada = false

      if (transicion.fijarYaw) {
        const rumbo = transicion.destino
        yawRef.current = interpolarAngulo(yawRef.current, rumbo.rotacionY, dt, 10)
        if (typeof rumbo.pitch === 'number') {
          pitchRef.current += (rumbo.pitch - pitchRef.current) * (1 - Math.exp(-10 * dt))
        }
      }

      transicion.tiempo += dt
      // La posición puede llegar antes que el giro: se mantiene la transición
      // activa hasta cumplir `duracionMin` para que el giro se vea suave.
      const puedeTerminar = transicion.tiempo >= (transicion.duracionMin || 0)
      if ((llegada && puedeTerminar) || transicion.tiempo > transicion.duracionMax) {
        terminarTransicion(transicion)
      }
    } else if (!movimientoBloqueado) {
      // Movimiento manual con aceleración y frenado suaves.
      const teclas = teclasRef.current
      const yaw = yawRef.current
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

      // Joystick virtual (móvil/tablet): vector [-1,1] ya orientado respecto a la
      // cámara por el propio componente del joystick.
      const joystick = joystickRef?.current
      if (joystick && (joystick.x !== 0 || joystick.y !== 0)) {
        dirTemp.current.x += direccionRef.current.x * joystick.y + lateralRef.current.x * joystick.x
        dirTemp.current.z += direccionRef.current.z * joystick.y + lateralRef.current.z * joystick.x
      }

      const largo = Math.hypot(dirTemp.current.x, dirTemp.current.z)
      const rapidez = VELOCIDAD * (correrRef.current ? VELOCIDAD_CORRER : 1)
      let objetivoX = 0
      let objetivoZ = 0
      if (largo > 0) {
        objetivoX = (dirTemp.current.x / largo) * rapidez
        objetivoZ = (dirTemp.current.z / largo) * rapidez
      }
      suavizarVelocidad(
        velocidadRef.current,
        objetivoX,
        objetivoZ,
        dt,
        largo > 0 ? ACELERACION : FRENADO,
      )

      const dx = velocidadRef.current.vx * dt
      const dz = velocidadRef.current.vz * dt
      if (dx !== 0 || dz !== 0) {
        const bloqueado = aplicarDesplazamiento(
          camara.position,
          dx,
          dz,
          detector,
          limites,
          registrarBloqueo,
        )
        if (bloqueado) {
          velocidadRef.current.vx = 0
          velocidadRef.current.vz = 0
        }
      }
    }

    camara.position.y = ALTURA_OJO

    // Vegetación: oculta por distancia al visitante (solo visual). Se recalcula
    // como mucho dos veces por segundo para no costar por fotograma.
    if (plantasRef.current.length > 0) {
      const cambios = actualizarVegetacion(plantasRef.current, camara.position, {
        intervalo: 0.5,
        ahora: state.clock.elapsedTime,
        estado: vegetacionEstadoRef.current,
      })
      if (cambios) invalidate()
    }

    // Activación por permanencia: acumula tiempo mientras el visitante está
    // quieto y el cursor (o la mira) sigue sobre la misma pieza. Se cancela si
    // se mueve, si hay una transición/ruta en curso o si se está arrastrando.
    {
      const p = permanenciaRef.current
      const velocidad = Math.hypot(velocidadRef.current.vx, velocidadRef.current.vz)
      const enTransicion = transicionRef.current.activa
      const arrastrando = arrastreRef.current.activo
      const cerrada = fichaCerradaRef?.current || null
      const yaAbierta = piezaSeleccionada?.ubicacionId === p.id
      const puedeAcumular =
        p.id &&
        !p.abierta &&
        !yaAbierta &&
        !enTransicion &&
        !arrastrando &&
        velocidad <= VELOCIDAD_PERMANENCIA &&
        p.id !== cerrada

      if (!puedeAcumular) {
        if (p.tiempo !== 0) {
          p.tiempo = 0
          alPermanencia(
            p.id
              ? { ubicacionId: p.id, x: p.posicion.x, y: p.posicion.y, progreso: 0 }
              : null,
          )
        }
      } else {
        p.tiempo = Math.min(PERMANENCIA_FICHA, p.tiempo + dt)
        // Solo se informa cuando el círculo avanza lo suficiente (≈4 %) desde
        // el último aviso, para no provocar un re-render de React por fotograma.
        if (p.tiempo >= PERMANENCIA_FICHA) {
          p.abierta = true
          p.tiempo = 0
          p.informado = 0
          alFichaPorPermanencia?.(p.id)
        } else if (p.tiempo - (p.informado || 0) >= PERMANENCIA_FICHA * 0.04) {
          p.informado = p.tiempo
          alPermanencia({
            ubicacionId: p.id,
            x: p.posicion.x,
            y: p.posicion.y,
            progreso: p.tiempo / PERMANENCIA_FICHA,
          })
        }
      }
    }

    // En inmersivo, el hover se calcula con la mira central.
    if (activo) {
      const ahora = performance.now()
      if (ahora - hoverRef.current.ultimo >= INTERVALO_HOVER * 1000) {
        hoverRef.current.ultimo = ahora
        raycaster.setFromCamera({ x: 0, y: 0 }, camara)
        let mejor = null
        let mejorDistancia = Infinity
        for (const ancla of anclasRef.current) {
          if (!clickeables.has(ancla.ubicacionId)) continue
          if (raycaster.ray.intersectBox(ancla.caja, impactoRef.current)) {
            const distancia = impactoRef.current.distanceToSquared(raycaster.ray.origin)
            if (distancia < mejorDistancia) {
              mejorDistancia = distancia
              mejor = ancla
            }
          }
        }
        const rect = gl.domElement.getBoundingClientRect()
        fijarPiezaApuntada(mejor, rect.width / 2, rect.height * 0.45)
      }
    }

    // Indicador y logs de depuración.
    if (debugRef.current.activo) {
      const ahora = state.clock.elapsedTime
      if (ahora - debugRef.current.ultimoPos >= 2) {
        debugRef.current.ultimoPos = ahora
        console.info(
          `[recorrido 3D debug] posición x=${camara.position.x.toFixed(2)} z=${camara.position.z.toFixed(2)}`,
        )
      }
    }
  })

  return (
    <group ref={grupoRef}>
      <primitive object={clon} />
      {modoDebug && <group ref={debugGrupoRef} name="DEBUG_colisiones" />}
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

// Joystick virtual. Mantiene el vector en `joystickRef` (x = lateral, y =
// adelante) y no vuelve a renderizar por cada movimiento del dedo: actualiza el
// estilo del pomo directamente.
function JoystickVirtual({ joystickRef }) {
  const baseRef = useRef(null)
  const pomoRef = useRef(null)
  const arrastreRef = useRef({ id: null })

  const fijar = (x, y) => {
    if (pomoRef.current) {
      pomoRef.current.style.transform = `translate(${x}px, ${y}px)`
    }
  }

  const actualizar = (clientX, clientY) => {
    const base = baseRef.current
    if (!base || !joystickRef) return
    const rect = base.getBoundingClientRect()
    const anchoPomo = pomoRef.current?.offsetWidth || 44
    const radio = Math.max(18, (rect.width - anchoPomo) / 2)
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = clientX - cx
    let dy = clientY - cy
    const largo = Math.hypot(dx, dy)
    if (largo > radio) {
      dx = (dx / largo) * radio
      dy = (dy / largo) * radio
    }
    fijar(dx, dy)
    // Normaliza a [-1, 1]; el eje Y se invierte (arriba = avanzar).
    joystickRef.current = { x: dx / radio, y: -dy / radio }
  }

  const soltar = () => {
    arrastreRef.current.id = null
    fijar(0, 0)
    if (joystickRef) joystickRef.current = { x: 0, y: 0 }
  }

  const alBajar = (evento) => {
    evento.preventDefault()
    evento.stopPropagation()
    arrastreRef.current.id = evento.pointerId
    try {
      baseRef.current?.setPointerCapture(evento.pointerId)
    } catch {
      // Sin captura el joystick sigue funcionando mientras el dedo esté encima.
    }
    actualizar(evento.clientX, evento.clientY)
  }

  const alMover = (evento) => {
    if (arrastreRef.current.id !== evento.pointerId) return
    evento.preventDefault()
    evento.stopPropagation()
    actualizar(evento.clientX, evento.clientY)
  }

  const alSoltar = (evento) => {
    if (arrastreRef.current.id !== evento.pointerId) return
    evento.preventDefault()
    evento.stopPropagation()
    try {
      baseRef.current?.releasePointerCapture(evento.pointerId)
    } catch {
      // Ignorado: la captura pudo no haberse concedido.
    }
    soltar()
  }

  useEffect(() => {
    return () => {
      if (joystickRef) joystickRef.current = { x: 0, y: 0 }
    }
  }, [joystickRef])

  return (
    <div
      ref={baseRef}
      className="recorrido__joystick"
      role="presentation"
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
      onPointerLeave={soltar}
      onLostPointerCapture={soltar}
    >
      <span className="recorrido__joystick-pomo" ref={pomoRef} />
    </div>
  )
}

// Panel de ayuda con todas las formas de moverse.
const AYUDA_CONTROLES = [
  { tecla: 'WASD / flechas', texto: 'Caminar con inercia suave.' },
  { tecla: 'Shift', texto: 'Caminar más rápido.' },
  { tecla: 'Arrastrar', texto: 'Girar la vista con el botón izquierdo.' },
  { tecla: 'Rueda', texto: 'Avanzar o retroceder respetando las paredes.' },
  { tecla: 'Clic en el suelo', texto: 'Caminar hasta ese punto.' },
  { tecla: 'Permanencia', texto: 'Deja el cursor sobre una obra para ver su ficha.' },
  { tecla: 'Clic / doble clic', texto: 'Abrir la ficha al instante; con doble clic la cámara se acerca.' },
  { tecla: 'Modo inmersivo', texto: 'Captura el ratón; Esc para salir.' },
  { tecla: 'Ir a sala', texto: 'Ir con transición suave a cualquier sala o a la plaza.' },
  { tecla: 'Anterior / Siguiente', texto: 'Recorrido guiado por todas las obras.' },
  { tecla: 'Táctil', texto: 'Joystick para caminar y deslizar el dedo para mirar; toca una obra para ver la tarjeta y tócala otra vez para abrir la ficha.' },
  { tecla: 'H', texto: 'Mostrar u ocultar esta ayuda.' },
  { tecla: 'Esc o el botón Salir', texto: 'Salir del recorrido y volver a la portada.' },
]

function PanelAyuda({ onCerrar }) {
  return (
    <div className="recorrido__ayuda-telon" onClick={onCerrar}>
      <div
        className="recorrido__ayuda-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recorrido-ayuda-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="recorrido__ayuda-cabecera">
          <h2 className="recorrido__ayuda-titulo" id="recorrido-ayuda-titulo">
            Cómo moverse
          </h2>
          <button
            type="button"
            className="recorrido__ayuda-cerrar"
            onClick={onCerrar}
            aria-label="Cerrar la ayuda"
          >
            ×
          </button>
        </div>
        <ul className="recorrido__ayuda-lista">
          {AYUDA_CONTROLES.map((item) => (
            <li key={item.tecla} className="recorrido__ayuda-item">
              <span className="recorrido__ayuda-tecla">{item.tecla}</span>
              <span className="recorrido__ayuda-texto">{item.texto}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="recorrido__boton recorrido__ayuda-entendido" onClick={onCerrar}>
          Entendido
        </button>
      </div>
    </div>
  )
}


// Indicador de permanencia: un círculo junto al cursor que se va llenando
// mientras se mantiene el apuntado sobre una obra.
function IndicadorPermanencia({ x, y, progreso }) {
  const r = 11
  const perimetro = 2 * Math.PI * r
  const avance = Math.max(0, Math.min(1, progreso || 0))
  return (
    <div
      className="recorrido__permanencia"
      role="status"
      aria-live="polite"
      aria-label="Mantén el cursor para abrir la ficha"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      <svg viewBox="0 0 26 26" aria-hidden="true">
        <circle className="recorrido__permanencia-fondo" cx="13" cy="13" r={r} />
        <circle
          className="recorrido__permanencia-arco"
          cx="13"
          cy="13"
          r={r}
          strokeDasharray={perimetro}
          strokeDashoffset={perimetro * (1 - avance)}
        />
      </svg>
    </div>
  )
}

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
  const [explorando, setExplorando] = useState(false)
  const [activo, setActivo] = useState(false)
  const [soportado] = useState(
    () => typeof document !== 'undefined' && 'requestPointerLock' in Element.prototype,
  )
  const [pieza, setPieza] = useState(null)
  // Progreso de la activación por permanencia (círculo junto al cursor).
  const [permanencia, setPermanencia] = useState(null)
  // Pieza que el visitante acaba de cerrar: no debe reabrirse por permanencia
  // hasta que el cursor salga de ella y vuelva a entrar.
  const fichaCerradaRef = useRef(null)
  const [catalogo, setCatalogo] = useState(null)
  const [errorDatos, setErrorDatos] = useState(false)
  const [navegacion, setNavegacion] = useState({ salas: [], orden: [] })
  const [menuSalas, setMenuSalas] = useState(false)
  // La ayuda se muestra la primera vez. Se decide al inicializar el estado (no en
  // un efecto) para no provocar un render extra; localStorage puede fallar.
  const [ayudaVisible, setAyudaVisible] = useState(() => {
    try {
      return window.localStorage.getItem(CLAVE_AYUDA) !== '1'
    } catch {
      return true
    }
  })
  const { progress, active: cargando } = useProgress()

  // Órdenes para la escena (navegación rápida y recorrido guiado). Se usa un ref
  // para no re-crear los efectos de puntero del componente 3D.
  const accionesRef = useRef(null)
  // Vector del joystick virtual (x lateral, y adelante), en [-1, 1].
  const joystickRef = useRef({ x: 0, y: 0 })
  // Estado real de la captura del cursor y marca de liberaciones programáticas.
  const capturadoRef = useRef(false)
  const liberacionIntencionalRef = useRef(false)


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

  // Salida definitiva del recorrido: una sola pulsación de Esc (o el botón
  // "Salir") deja todo limpio y vuelve a la portada, sin cerrar por capas.
  const salirDelRecorrido = useCallback(() => {
    // 1. Detiene movimiento, transiciones y ruta dentro de la escena, y deja la
    //    cámara en el punto de aparición para la próxima entrada.
    accionesRef.current?.salir?.()
    // 2. Libera el cursor si sigue capturado (modo inmersivo). Es intencional:
    //    no debe relanzar la salida desde `pointerlockchange`.
    if (document.pointerLockElement) {
      liberacionIntencionalRef.current = true
      document.exitPointerLock()
    }
    // 3. Limpia todos los estados de interfaz de una vez.
    setPieza(null)
    setPermanencia(null)
    setMenuSalas(false)
    setAyudaVisible(false)
    setExplorando(false)
    setActivo(false)
  }, [])

  // Entra en el recorrido en modo exploración libre (sin capturar el cursor).
  const iniciar = useCallback(() => {
    setExplorando(true)
  }, [])

  // Entra en el recorrido en modo inmersivo (pointer lock).
  const iniciarInmersivo = useCallback(() => {
    setExplorando(true)
    const el = contenedorRef.current
    if (el && typeof el.requestPointerLock === 'function') {
      try {
        el.requestPointerLock()
      } catch {
        // Si el navegador lo rechaza, queda la exploración libre.
      }
    }
  }, [])

  const salirInmersivo = useCallback(() => {
    if (document.pointerLockElement) {
      liberacionIntencionalRef.current = true
      document.exitPointerLock()
    }
  }, [])

  // Captura y liberación del cursor. Al liberarlo el propio navegador (Esc) se
  // sale del recorrido a la portada en esa misma pulsación. Las liberaciones
  // programáticas (abrir la ficha o el botón de salir del modo inmersivo) se
  // marcan para no confundirlas con Esc. Solo se sale si antes estaba capturado,
  // para no expulsar al visitante cuando el navegador rechaza la captura.
  useEffect(() => {
    const alCambiar = () => {
      const capturado = document.pointerLockElement === contenedorRef.current
      const antes = capturadoRef.current
      capturadoRef.current = capturado
      setActivo(capturado)
      if (capturado) {
        setExplorando(true)
        liberacionIntencionalRef.current = false
        return
      }
      if (!antes) return
      if (liberacionIntencionalRef.current) {
        liberacionIntencionalRef.current = false
        return
      }
      // Sin marca: el navegador liberó el cursor (Esc) → salir del recorrido.
      salirDelRecorrido()
    }
    document.addEventListener('pointerlockchange', alCambiar)
    document.addEventListener('pointerlockerror', alCambiar)
    return () => {
      document.removeEventListener('pointerlockchange', alCambiar)
      document.removeEventListener('pointerlockerror', alCambiar)
      // Al desmontar (salir de la ruta) se libera el cursor sí o sí.
      if (document.pointerLockElement) document.exitPointerLock()
    }
  }, [salirDelRecorrido])

  // Ayuda: se muestra automáticamente la primera vez (ver el estado inicial).
  const cerrarAyuda = useCallback(() => {
    setAyudaVisible(false)
    try {
      window.localStorage.setItem(CLAVE_AYUDA, '1')
    } catch {
      // Sin almacenamiento la ayuda simplemente vuelve a mostrarse.
    }
  }, [])

  // Tecla H abre y cierra la ayuda (también con el recorrido activo).
  useEffect(() => {
    const alTeclear = (evento) => {
      if (evento.key !== 'h' && evento.key !== 'H') return
      if (evento.ctrlKey || evento.metaKey || evento.altKey) return
      if (evento.target instanceof Element && evento.target.closest(
        'input, select, textarea, [contenteditable="true"]',
      )) {
        return
      }
      evento.preventDefault()
      setAyudaVisible((visible) => {
        if (visible) {
          try {
            window.localStorage.setItem(CLAVE_AYUDA, '1')
          } catch {
            // Sin almacenamiento: se aplica igualmente.
          }
        }
        return !visible
      })
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])

  // Solo es clicable una pieza cuya ubicación esté en el catálogo de
  // exhibiciones ACTIVAS.
  const exhibicionParaUbicacion = useCallback(
    (ubicacionId) => {
      if (!ubicacionId || !exhibicionesPorUbicacion) return null
      return exhibicionesPorUbicacion.get(ubicacionId) ?? null
    },
    [exhibicionesPorUbicacion],
  )

  // Progreso de la permanencia. La escena calcula el temporizador por fotograma
  // (sin re-render) y solo avisa cuando cambia el progreso visible.
  const alPermanencia = useCallback(
    (datos) => {
      if (!datos) {
        setPermanencia(null)
        return
      }
      const exhibicion = exhibicionParaUbicacion(datos.ubicacionId)
      if (!exhibicion) {
        setPermanencia(null)
        return
      }
      setPermanencia({
        ubicacionId: datos.ubicacionId,
        exhibicion,
        x: datos.x,
        y: datos.y,
        progreso: datos.progreso,
      })
    },
    [exhibicionParaUbicacion],
  )

  // Abre la ficha (clic, doble clic o permanencia). Registra la visita solo la
  // primera vez que se abre esa pieza; reemplazar por otra no duplica el aviso.
  const abrirFicha = useCallback(
    (ubicacionId, { registrar = true } = {}) => {
      const exhibicion = exhibicionParaUbicacion(ubicacionId)
      if (!exhibicion) return

      setPieza({ ubicacionId, exhibicion })
      setPermanencia(null)
      setMenuSalas(false)
      // Se libera el cursor para que el visitante pueda leer y usar la ficha.
      // Es una liberación intencional: no debe interpretarse como Esc.
      if (document.pointerLockElement) {
        liberacionIntencionalRef.current = true
        document.exitPointerLock()
      }

      if (registrar) {
        registrarVisita(Number(exhibicion.id), obtenerSesionAnonima(), {
          fuente: FUENTE_CURSOR,
        }).catch(() => {
          // Silencioso a propósito: la visita es telemetría, no navegación.
        })
      }
    },
    [exhibicionParaUbicacion],
  )

  // Al hacer clic o doble clic: abre la ficha al instante (sin esperar la
  // permanencia).
  const alSeleccionar = useCallback(
    (ubicacionId) => {
      abrirFicha(ubicacionId)
    },
    [abrirFicha],
  )

  // Activación por permanencia: la escena avisa cuando el cursor (o la mira) se
  // ha mantenido sobre una obra el tiempo configurado. Si ya hay una ficha
  // abierta, se reemplaza por la de la nueva pieza.
  const alFichaPorPermanencia = useCallback(
    (ubicacionId) => {
      if (!ubicacionId) return
      abrirFicha(ubicacionId)
    },
    [abrirFicha],
  )

  // Cierra la ficha sin reiniciar el recorrido ni volver a capturar el cursor.
  // Recuerda qué pieza se cerró para no reabrirla por permanencia hasta que el
  // cursor salga de ella y vuelva a entrar.
  const cerrarFicha = useCallback(() => {
    setPieza((actual) => {
      if (actual) fichaCerradaRef.current = actual.ubicacionId
      return null
    })
    setPermanencia(null)
  }, [])

  // Registro de destinos y orden de piezas que publica la escena al cargar.
  const alRegistrarNavegacion = useCallback((datos) => {
    setNavegacion({
      salas: Array.isArray(datos.salas) ? datos.salas : [],
      orden: Array.isArray(datos.orden) ? datos.orden : [],
    })
  }, [])

  // Piezas del recorrido guiado: solo las que tienen exhibición activa en la API,
  // en el orden del contrato (S1_01 … S6_02 y la plaza central al final).
  const recorridoGuiado = useMemo(
    () => navegacion.orden.filter((id) => exhibicionParaUbicacion(id)),
    [navegacion.orden, exhibicionParaUbicacion],
  )

  const indiceActual = useMemo(() => {
    if (!pieza) return -1
    return recorridoGuiado.indexOf(pieza.ubicacionId)
  }, [pieza, recorridoGuiado])

  // Pide a la escena que navegue a una sala (ruta con colisiones) o a una pieza.
  const pedirSala = useCallback(
    (clave) => {
      accionesRef.current?.irASala(clave)
      setMenuSalas(false)
    },
    [],
  )

  const pedirExhibicion = useCallback((ubicacionId) => {
    if (!ubicacionId) return
    setMenuSalas(false)
    accionesRef.current?.irAExhibicion(ubicacionId)
  }, [])

  const irAAnterior = useCallback(() => {
    if (recorridoGuiado.length === 0) return
    const base = indiceActual >= 0 ? indiceActual : 0
    const anterior = base === 0 ? recorridoGuiado.length - 1 : base - 1
    pedirExhibicion(recorridoGuiado[anterior])
  }, [indiceActual, pedirExhibicion, recorridoGuiado])

  const irASiguiente = useCallback(() => {
    if (recorridoGuiado.length === 0) return
    const base = indiceActual >= 0 ? indiceActual : -1
    const siguiente = (base + 1) % recorridoGuiado.length
    pedirExhibicion(recorridoGuiado[siguiente])
  }, [indiceActual, pedirExhibicion, recorridoGuiado])

  // Escape sale del recorrido de forma definitiva en una sola pulsación, en
  // cualquier estado (ficha, ayuda, menú de salas o exploración libre). No
  // cierra por capas.
  useEffect(() => {
    const alTeclear = (evento) => {
      if (evento.key !== 'Escape') return
      // Con el cursor capturado, el navegador gestiona Escape para liberarlo;
      // la salida se completa desde `pointerlockchange`.
      if (document.pointerLockElement) return
      evento.preventDefault()
      salirDelRecorrido()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [salirDelRecorrido])

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
            frameloop={explorando || activo ? 'always' : 'demand'}
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
                explorando={explorando}
                alSeleccionar={alSeleccionar}
                alPermanencia={alPermanencia}
                alRegistrarNavegacion={alRegistrarNavegacion}
                accionesRef={accionesRef}
                joystickRef={joystickRef}
                fichaCerradaRef={fichaCerradaRef}
                alFichaPorPermanencia={alFichaPorPermanencia}
                piezaSeleccionada={pieza}
                exhibicionesPorUbicacion={exhibicionesPorUbicacion}
              />
            </Suspense>
          </Canvas>

          {explorando && (
            <button
              type="button"
              className="recorrido__salir"
              onClick={salirDelRecorrido}
              aria-label="Salir del recorrido"
              title="Salir del recorrido (Esc)"
            >
              <svg
                className="recorrido__salir-icono"
                viewBox="0 0 24 24"
                role="presentation"
                aria-hidden="true"
              >
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
                <path d="M10 8l-4 4 4 4" />
                <path d="M6 12h9" />
              </svg>
              <span>Salir del recorrido</span>
            </button>
          )}

          {activo && <div className="recorrido__mira" aria-hidden="true" />}

          {explorando && !pieza && <JoystickVirtual joystickRef={joystickRef} />}

          {explorando && !pieza && permanencia && (
            <IndicadorPermanencia
              x={permanencia.x}
              y={permanencia.y}
              progreso={permanencia.progreso}
            />
          )}

          {/* Ficha ampliada: vive fuera del bloque `explorando` porque al abrirla
              se libera el cursor y debe seguir visible hasta que se cierre. */}
          {pieza && (
            <FichaPieza
              exhibicion={pieza.exhibicion}
              errorDatos={errorDatos}
              onCerrar={cerrarFicha}
            />
          )}

          {!explorando && !pieza && (
            <div className="recorrido__portada">
              {cargando && progress < 100 ? (
                <Cargando progreso={progress} />
              ) : (
                <>
                  <p className="recorrido__portada-titulo">Visita guiada 3D</p>
                  <div className="recorrido__portada-acciones">
                    <button type="button" className="recorrido__boton" onClick={iniciar}>
                      Comenzar recorrido
                    </button>
                    {soportado && (
                      <button
                        type="button"
                        className="recorrido__boton recorrido__boton--secundario"
                        onClick={iniciarInmersivo}
                      >
                        Modo inmersivo
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="recorrido__controles">
          {explorando && (
            <div className="recorrido__nav" role="group" aria-label="Navegación rápida">
              <div className="recorrido__nav-fila">
                <button
                  type="button"
                  className="recorrido__nav-boton"
                  aria-expanded={menuSalas}
                  aria-haspopup="true"
                  onClick={() => setMenuSalas((abierto) => !abierto)}
                  disabled={navegacion.salas.length === 0}
                >
                  Ir a sala
                </button>
                <button
                  type="button"
                  className="recorrido__nav-boton"
                  onClick={irAAnterior}
                  disabled={recorridoGuiado.length === 0}
                  title="Exhibición anterior del recorrido guiado"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="recorrido__nav-boton"
                  onClick={irASiguiente}
                  disabled={recorridoGuiado.length === 0}
                  title="Exhibición siguiente del recorrido guiado"
                >
                  Siguiente
                </button>
              </div>

              {menuSalas && navegacion.salas.length > 0 && (
                <ul className="recorrido__nav-menu" role="menu">
                  {navegacion.salas.map((sala) => (
                    <li key={sala.clave} role="none">
                      <button
                        type="button"
                        role="menuitem"
                        className="recorrido__nav-opcion"
                        onClick={() => pedirSala(sala.clave)}
                      >
                        {sala.etiqueta}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {errorPantalla && (
            <p className="recorrido__controles-aviso" role="alert">
              {errorPantalla}
            </p>
          )}
          <button
            type="button"
            className="recorrido__pantalla recorrido__pantalla--icono"
            onClick={() => {
              setMenuSalas(false)
              setAyudaVisible(true)
            }}
            aria-label="Mostrar la ayuda de controles"
            title="Ayuda de controles (H)"
          >
            <span aria-hidden="true">?</span>
          </button>
          {soportado && explorando && (
            <button
              type="button"
              className="recorrido__pantalla"
              onClick={activo ? salirInmersivo : iniciarInmersivo}
              aria-pressed={activo}
              title="Captura el ratón para mirar sin pulsar. Sal con Esc."
            >
              <span>{activo ? 'Salir del modo inmersivo' : 'Modo inmersivo'}</span>
            </button>
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

        {ayudaVisible && <PanelAyuda onCerrar={cerrarAyuda} />}
      </div>
    </section>
  )
}


