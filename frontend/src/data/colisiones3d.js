// Colisiones precisas del recorrido 3D.
//
// Sustituye las cajas envolventes (Box3) por raycast contra la geometría real de
// las mallas colisionables. La aceleración la aporta three-mesh-bvh: se construye
// un BVH una sola vez al cargar el modelo (`computeBoundsTree`) y se usa
// `acceleratedRaycast` únicamente en esas mallas, sin parchear el resto de la
// escena.
//
// El visitante se modela como un cilindro de radio RADIO_JUGADOR: en cada eje se
// lanza un rayo horizontal en la dirección del movimiento a la altura de las
// rodillas y del pecho. Resolver X y Z por separado permite deslizarse por las
// paredes sin quedarse clavado en las esquinas.
//
// Detalle importante: el raycast se hace contra "proxies" invisibles que
// comparten la geometría (y por tanto el BVH) de las mallas reales, pero usan un
// material propio con `side: DoubleSide`. Así una pared no deja de colisionar
// según desde qué lado se mire y no se altera el material visible del modelo.

import { Box3, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from 'three-mesh-bvh'
import {
  ALTURAS_COLISION,
  ALTURA_MINIMA_COLISION,
  RADIO_JUGADOR,
  esCajaColision,
  esColision,
} from './museo3d'

const HOJA_PUERTA = /^Puerta_(Hoja|Vidrio)/

const _origen = new Vector3()
const _direccion = new Vector3()
const _lateral = new Vector3()
const _caja = new Box3()

function cajaDePatron(raiz, patron) {
  const caja = new Box3()
  let encontrado = false
  raiz.traverse((objeto) => {
    if (!objeto.isMesh || objeto.isInstancedMesh) return
    if (!patron.test(objeto.name)) return
    caja.expandByObject(objeto)
    encontrado = true
  })
  return encontrado && !caja.isEmpty() ? caja : null
}

function alturaDe(malla) {
  _caja.setFromObject(malla)
  return _caja.isEmpty() ? 0 : _caja.max.y - _caja.min.y
}

// Una hoja de puerta está "abierta" cuando su panel gira hacia dentro y queda
// perpendicular al plano de la fachada. Comparando el eje horizontal largo de la
// hoja con el eje de anchura del vano (el eje largo de la fachada) se distingue
// sin depender de nombres de salas ni de coordenadas fijas.
function hojaAbierta(malla, fachada) {
  if (!fachada) return true
  const exFachada = fachada.max.x - fachada.min.x
  const ezFachada = fachada.max.z - fachada.min.z
  const ejeAncho = exFachada >= ezFachada ? 'x' : 'z'

  const caja = new Box3().setFromObject(malla)
  if (caja.isEmpty()) return true
  const exHoja = caja.max.x - caja.min.x
  const ezHoja = caja.max.z - caja.min.z

  // Cerrada: la hoja ocupa el ancho del vano. Abierta: su lado largo queda
  // perpendicular a la fachada (a lo largo de la normal).
  const anchoHoja = ejeAncho === 'x' ? exHoja : ezHoja
  const fondoHoja = ejeAncho === 'x' ? ezHoja : exHoja
  return fondoHoja > anchoHoja
}

// Devuelve el estado de cada hoja de puerta para poder informarlo y decidir si
// debe colisionar.
export function analizarPuertas(raiz) {
  if (!raiz) return []
  const fachada = cajaDePatron(raiz, /^Fachada_/)
  const puertas = []
  raiz.traverse((objeto) => {
    if (!objeto.isMesh || !HOJA_PUERTA.test(objeto.name)) return
    const abierta = hojaAbierta(objeto, fachada)
    puertas.push({
      nombre: objeto.name,
      abierta,
      motivo: abierta
        ? 'hoja girada fuera del vano: no tapa el paso'
        : 'hoja cerrada sobre el vano: bloquea el paso',
    })
  })
  return puertas
}

// Prepara el modelo para colisionar. Devuelve:
//   - mallas: objetos reales usados como fuente (para informar),
//   - proxies: mallas invisibles con material DoubleSide que se raycastan,
//   - material: material compartido de los proxies (se libera al desmontar),
//   - modo, puertas y geometrías con BVH (para liberarlas).
export function prepararColisiones(raiz) {
  const resultado = {
    mallas: [],
    proxies: [],
    material: null,
    modo: 'ninguno',
    puertas: [],
    geometrias: new Set(),
  }
  if (!raiz) return resultado

  raiz.updateMatrixWorld(true)

  // 1. ¿El modelo trae cajas invisibles COL_*? Entonces son la única fuente de
  //    colisión y se ocultan.
  const cajasBlender = []
  raiz.traverse((objeto) => {
    if (objeto.isMesh && esCajaColision(objeto.name)) cajasBlender.push(objeto)
  })

  // 2. Hojas de puerta: solo colisionan si están cerradas.
  resultado.puertas = analizarPuertas(raiz)
  const hojasBloqueantes = new Set(
    resultado.puertas.filter((p) => !p.abierta).map((p) => p.nombre),
  )

  if (cajasBlender.length > 0) {
    resultado.modo = 'COL_*'
    for (const caja of cajasBlender) {
      // Las cajas de Blender son solo volumen de colisión: no se muestran.
      caja.visible = false
      resultado.mallas.push(caja)
    }
  } else {
    resultado.modo = 'prefijos'
    raiz.traverse((objeto) => {
      // Plantas y vegetación instanciada nunca frenan al visitante.
      if (!objeto.isMesh || objeto.isInstancedMesh) return
      const nombre = objeto.name
      const colisiona = esColision(nombre) || hojasBloqueantes.has(nombre)
      if (!colisiona) return
      // Objetos demasiado bajos se pisan, no bloquean.
      if (alturaDe(objeto) < ALTURA_MINIMA_COLISION) return
      resultado.mallas.push(objeto)
    })
  }

  if (resultado.mallas.length === 0) return resultado

  // 3. BVH por geometría (varias mallas del modelo comparten geometría) y proxy
  //    raycastable. El BVH vive en la geometría, que también comparten otros
  //    clones (por ejemplo, el doble montaje de StrictMode): se cuenta una vez
  //    por preparación y geometría, y solo se destruye cuando nadie la usa.
  resultado.material = new MeshBasicMaterial({ side: DoubleSide })
  for (const malla of resultado.mallas) {
    const geometria = malla.geometry
    if (!geometria) continue
    if (!geometria.boundsTree) {
      computeBoundsTree.call(geometria)
    }
    // Se añade al Set una sola vez por preparación; el Set ya deduplica.
    const yaContada = resultado.geometrias.has(geometria)
    resultado.geometrias.add(geometria)
    if (!yaContada) {
      geometria.userData.refsColision = (geometria.userData.refsColision || 0) + 1
    }
    const proxy = new Mesh(geometria, resultado.material)
    proxy.name = malla.name
    proxy.userData.mallaOrigen = malla
    proxy.matrixAutoUpdate = false
    proxy.matrix.copy(malla.matrixWorld)
    proxy.matrixWorld.copy(malla.matrixWorld)
    proxy.raycast = acceleratedRaycast
    resultado.proxies.push(proxy)
  }

  return resultado
}

// Libera los BVH y el material de los proxies. Un BVH solo se destruye cuando
// ninguna otra preparación lo referencia.
export function liberarColisiones(preparacion) {
  if (!preparacion) return
  for (const geometria of preparacion.geometrias) {
    const refs = (geometria.userData.refsColision || 1) - 1
    geometria.userData.refsColision = refs
    if (refs <= 0) {
      delete geometria.userData.refsColision
      disposeBoundsTree.call(geometria)
    }
  }
  preparacion.geometrias.clear()
  preparacion.proxies.length = 0
  if (preparacion.material) {
    preparacion.material.dispose()
    preparacion.material = null
  }
}

// Rejilla espacial en el plano XZ para no lanzar el rayo contra todas las mallas
// colisionables en cada consulta. Con ~400 mallas arquitectónicas, recorrerlas
// todas cuesta milisegundos por fotograma; limitar la consulta a las celdas que
// atraviesa el rayo lo deja en decenas de microsegundos.
const TAMANO_CELDA = 2

function claveCelda(cx, cz) {
  return `${cx}:${cz}`
}

class RejillaColisiones {
  constructor(proxies) {
    this.celdas = new Map()
    this.marca = new Map()
    this.turno = 0
    for (const proxy of proxies) {
      const caja = new Box3().setFromObject(proxy)
      if (caja.isEmpty()) continue
      const x0 = Math.floor(caja.min.x / TAMANO_CELDA)
      const x1 = Math.floor(caja.max.x / TAMANO_CELDA)
      const z0 = Math.floor(caja.min.z / TAMANO_CELDA)
      const z1 = Math.floor(caja.max.z / TAMANO_CELDA)
      for (let cx = x0; cx <= x1; cx += 1) {
        for (let cz = z0; cz <= z1; cz += 1) {
          const clave = claveCelda(cx, cz)
          let lista = this.celdas.get(clave)
          if (!lista) {
            lista = []
            this.celdas.set(clave, lista)
          }
          lista.push(proxy)
        }
      }
    }
    this.resultado = []
  }

  // Proxies cuyas celdas toca el segmento (x, z) -> (x+dx, z+dz) con radio. Se
  // evita repetir proxies con una marca por turno en lugar de crear un Set.
  candidatos(x, z, dx, dz, radio) {
    const salida = this.resultado
    salida.length = 0
    const turno = (this.turno += 1)
    const minX = Math.min(x, x + dx) - radio
    const maxX = Math.max(x, x + dx) + radio
    const minZ = Math.min(z, z + dz) - radio
    const maxZ = Math.max(z, z + dz) + radio
    const cx0 = Math.floor(minX / TAMANO_CELDA)
    const cx1 = Math.floor(maxX / TAMANO_CELDA)
    const cz0 = Math.floor(minZ / TAMANO_CELDA)
    const cz1 = Math.floor(maxZ / TAMANO_CELDA)
    for (let cx = cx0; cx <= cx1; cx += 1) {
      for (let cz = cz0; cz <= cz1; cz += 1) {
        const lista = this.celdas.get(claveCelda(cx, cz))
        if (!lista) continue
        for (const proxy of lista) {
          if (this.marca.get(proxy) === turno) continue
          this.marca.set(proxy, turno)
          salida.push(proxy)
        }
      }
    }
    return salida
  }
}

// Detector de colisiones por raycast horizontal.
export function crearDetector(proxies) {
  const raycaster = new Raycaster()
  raycaster.firstHitOnly = true
  raycaster.near = 0
  const rejilla = new RejillaColisiones(proxies)

  // ¿Bloquea el paso un desplazamiento (dx, dz) de longitud `paso`? Devuelve la
  // malla que bloquea o null. El rayo parte de la posición actual y alcanza el
  // borde del cilindro del visitante (RADIO_JUGADOR) más el propio paso del
  // fotograma, evitando atravesar la pared por tunneling.
  function bloquea(x, z, dx, dz, paso) {
    if (proxies.length === 0) return null
    const largo = Math.hypot(dx, dz)
    if (largo === 0) return null

    _direccion.set(dx / largo, 0, dz / largo)
    _lateral.set(-_direccion.z, 0, _direccion.x)
    const alcance = RADIO_JUGADOR + paso + 0.001
    const candidatos = rejilla.candidatos(x, z, dx, dz, RADIO_JUGADOR + paso)

    for (const altura of ALTURAS_COLISION) {
      for (const desplazamiento of [-RADIO_JUGADOR * 0.9, 0, RADIO_JUGADOR * 0.9]) {
        _origen.set(
          x + _lateral.x * desplazamiento,
          altura,
          z + _lateral.z * desplazamiento,
        )
        raycaster.set(_origen, _direccion)
        raycaster.far = alcance
        const impactos = raycaster.intersectObjects(candidatos, false)
        if (impactos.length > 0) return impactos[0].object
      }
    }
    return null
  }

  return { bloquea }
}

// Ayudas visuales del modo de depuración: una malla de alambre por cada proxy,
// compartiendo la geometría real y su transformación de mundo.
export function crearAyudasDebug(proxies) {
  const material = new MeshBasicMaterial({
    color: 0x38ff9c,
    wireframe: true,
    transparent: true,
    opacity: 0.55,
    depthTest: false,
  })
  const objetos = []
  for (const proxy of proxies) {
    if (!proxy.geometry) continue
    const ayuda = new Mesh(proxy.geometry, material)
    ayuda.name = `DEBUG_${proxy.name}`
    ayuda.matrixAutoUpdate = false
    ayuda.matrix.copy(proxy.matrixWorld)
    ayuda.matrixWorld.copy(proxy.matrixWorld)
    objetos.push(ayuda)
  }
  return { material, objetos }
}

// ¿La posición (x, z) cae fuera de los límites calculados?
export function fueraDeLimites(x, z, limites) {
  if (!limites) return false
  return x < limites.xMin || x > limites.xMax || z < limites.zMin || z > limites.zMax
}
