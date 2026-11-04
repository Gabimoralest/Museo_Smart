// Destinos de navegación rápida del recorrido 3D.
//
// Todo se deriva de la geometría del propio modelo; no hay coordenadas fijas:
//
//   * Sala N: se usa el nodo `SALA_N` si existe (vacíos de Blender); si el
//     modelo no los trae, su `Piso_SalaN`; y como último respaldo, la unión de
//     las cajas de las exhibiciones de esa sala.
//   * Plaza central: se usa el centro de `Piso_B_Plaza` (o la caja de
//     `EXH_CENTRO_01` si el piso no existe), mirando hacia la estatua.
//
// El orden del recorrido guiado se obtiene de los IDs del contrato
// (`EXH_S1_01` … `EXH_S6_02` y `EXH_CENTRO_01` al final), sin depender del orden
// en que el GLB devuelva los nodos.

import { Box3, Vector3 } from 'three'
import { calcularAcercamiento } from './museo3d'

const CLAVE_PLAZA = 'CENTRO'

// Caja envolvente de un nodo por nombre (incluye sus hijos). Devuelve null si no
// existe o no tiene geometría.
function cajaDeNodo(raiz, nombre) {
  let objetivo = null
  raiz.traverse((objeto) => {
    if (objetivo) return
    if (objeto.name === nombre) objetivo = objeto
  })
  if (!objetivo) return null
  const caja = new Box3().setFromObject(objetivo)
  return caja.isEmpty() ? null : caja
}

function cajaDeAnclas(anclas) {
  if (!anclas || anclas.length === 0) return null
  const caja = new Box3()
  for (const ancla of anclas) caja.union(ancla.caja)
  return caja.isEmpty() ? null : caja
}

// Ángulo de giro que mira desde `origen` hacia `objetivo`.
function mirarHacia(origen, objetivo) {
  const dx = objetivo.x - origen.x
  const dz = objetivo.z - origen.z
  if (Math.hypot(dx, dz) < 0.2) return 0
  return Math.atan2(-dx, -dz)
}

// Lista ordenada de destinos de "Ir a sala": las 6 salas y la plaza central.
// Cada destino es { clave, etiqueta, destino: { x, z, rotacionY, pitch }, fuente }.
export function calcularSalas(raiz, anclas) {
  if (!raiz) return []
  const salas = []

  for (let numero = 1; numero <= 6; numero += 1) {
    const propias = anclas.filter((a) => a.ubicacionId.startsWith(`EXH_S${numero}_`))

    let caja = null
    let fuente = null
    for (const nombre of [`SALA_${numero}`, `Piso_Sala${numero}`, `Sala_${numero}`]) {
      const encontrada = cajaDeNodo(raiz, nombre)
      if (encontrada) {
        caja = encontrada
        fuente = nombre
        break
      }
    }
    if (!caja) {
      caja = cajaDeAnclas(propias)
      if (caja) fuente = 'anclas'
    }
    if (!caja) continue

    const centro = caja.getCenter(new Vector3())
    // Se mira hacia las piezas de la sala; si no hay, hacia el centro del museo
    // (el propio centro de la caja de la sala deja de ser una referencia útil).
    let rotacionY = 0
    if (propias.length > 0) {
      const objetivo = new Vector3()
      for (const ancla of propias) objetivo.add(ancla.caja.getCenter(new Vector3()))
      objetivo.multiplyScalar(1 / propias.length)
      rotacionY = mirarHacia(centro, objetivo)
    }

    salas.push({
      clave: `S${numero}`,
      etiqueta: `Sala ${numero}`,
      fuente,
      destino: { x: centro.x, z: centro.z, rotacionY, pitch: 0 },
    })
  }

  // Plaza central: centro del piso de la plaza mirando a la estatua.
  const anclaCentro = anclas.find((a) => a.ubicacionId === 'EXH_CENTRO_01')
  const estatua = anclaCentro ? anclaCentro.caja.getCenter(new Vector3()) : null
  const pisoPlaza = cajaDeNodo(raiz, 'Piso_B_Plaza')
  const cajaPlaza = pisoPlaza || cajaDeNodo(raiz, 'Piso_A_Hall') || (anclaCentro ? anclaCentro.caja : null)

  if (cajaPlaza) {
    const centro = cajaPlaza.getCenter(new Vector3())
    salas.push({
      clave: CLAVE_PLAZA,
      etiqueta: 'Plaza central',
      fuente: pisoPlaza ? 'Piso_B_Plaza' : 'EXH_CENTRO_01',
      destino: {
        x: centro.x,
        z: centro.z,
        rotacionY: estatua ? mirarHacia(centro, estatua) : 0,
        pitch: 0,
      },
    })
  } else if (anclaCentro) {
    const destino = calcularAcercamiento(anclaCentro.caja, null)
    if (destino) {
      salas.push({
        clave: CLAVE_PLAZA,
        etiqueta: 'Plaza central',
        fuente: 'EXH_CENTRO_01',
        destino,
      })
    }
  }

  return salas
}

// Orden del recorrido guiado: S1_01, S1_02, S2_01 … S6_02 y la estatua central
// al final. Cualquier ID que no siga el contrato se coloca al final por orden
// alfabético, para no perderlo.
function rangoOrden(ubicacionId) {
  const coincidencia = /^EXH_S(\d+)_(\d+)$/.exec(ubicacionId)
  if (coincidencia) return [Number(coincidencia[1]), Number(coincidencia[2])]
  if (ubicacionId === 'EXH_CENTRO_01') return [99, 0]
  return [98, 0]
}

export function ordenarPiezas(anclas) {
  return [...anclas]
    .sort((a, b) => {
      const ra = rangoOrden(a.ubicacionId)
      const rb = rangoOrden(b.ubicacionId)
      return ra[0] - rb[0] || ra[1] - rb[1] || a.ubicacionId.localeCompare(b.ubicacionId)
    })
    .map((ancla) => ancla.ubicacionId)
}
