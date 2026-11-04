// Búsqueda de rutas para la navegación automática del recorrido 3D.
//
// Una transición recta desde una sala a otra cruzarla los muros, así que la
// navegación rápida calcula un camino sobre una rejilla y lo alisa. Todas las
// comprobaciones usan el detector de `colisiones3d.js`, de modo que la ruta
// resultante nunca atraviesa paredes.
//
// La rejilla se construye solo en la región entre origen y destino (con un
// margen), no en todo el museo, y solo cuando hay una navegación pendiente.

import { RADIO_JUGADOR } from './museo3d'

const TAM_CELDA = 2
const MARGEN = 8
const MAX_CELDAS = 3000
const MAX_RAYOS = 14000

const DESPLAZAMIENTOS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

function limitar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor))
}

// ¿Puede el visitante estar de pie en (x, z)? Se aproxima con cuatro rayos
// cortos (uno por punto cardinal) que cubren el radio del jugador. El movimiento
// real usa el detector completo en cada paso, así que una aproximación optimista
// aquí nunca permite atravesar una pared.
function libre(x, z, detector) {
  if (!detector) return true
  for (const [dx, dz] of DESPLAZAMIENTOS) {
    if (detector.bloquea(x, z, dx, dz, 0.05)) return false
  }
  return true
}

// ¿Se puede ir en línea recta de (ax, az) a (bx, bz)? El rayo se ajusta para
// terminar justo en el destino.
function visible(ax, az, bx, bz, detector) {
  if (!detector) return true
  const dx = bx - ax
  const dz = bz - az
  const largo = Math.hypot(dx, dz)
  if (largo < 1e-4) return true
  const paso = Math.max(0.05, largo - RADIO_JUGADOR)
  return !detector.bloquea(ax, az, dx, dz, paso)
}

// Devuelve una lista de puntos { x, z } desde el inicio hasta el destino, sin
// atravesar paredes. Si no hay ruta (o es demasiado costosa), devuelve null para
// que el llamador use el movimiento recto habitual (que también colisiona).
export function buscarRuta({ inicio, destino, detector, limites }) {
  if (!detector || !destino) return null
  if (visible(inicio.x, inicio.z, destino.x, destino.z, detector)) {
    return [{ x: destino.x, z: destino.z }]
  }

  const minX = Math.max(limites ? limites.xMin : -Infinity, Math.min(inicio.x, destino.x) - MARGEN)
  const maxX = Math.min(limites ? limites.xMax : Infinity, Math.max(inicio.x, destino.x) + MARGEN)
  const minZ = Math.max(limites ? limites.zMin : -Infinity, Math.min(inicio.z, destino.z) - MARGEN)
  const maxZ = Math.min(limites ? limites.zMax : Infinity, Math.max(inicio.z, destino.z) + MARGEN)

  const columnas = Math.floor((maxX - minX) / TAM_CELDA) + 1
  const filas = Math.floor((maxZ - minZ) / TAM_CELDA) + 1
  if (columnas <= 0 || filas <= 0 || columnas * filas > MAX_CELDAS) return null

  const total = columnas * filas
  const centroX = (ix) => minX + ix * TAM_CELDA
  const centroZ = (iz) => minZ + iz * TAM_CELDA

  const indiceDe = (ix, iz) => iz * columnas + ix
  const ixDe = (x) => limitar(Math.round((x - minX) / TAM_CELDA), 0, columnas - 1)
  const izDe = (z) => limitar(Math.round((z - minZ) / TAM_CELDA), 0, filas - 1)

  // Estado por celda: DESCONOCIDA, LIBRE o BLOQUEADA.
  const DESCONOCIDA = -1
  const BLOQUEADA = 0
  const LIBRE = 1
  const estado = new Int8Array(total).fill(DESCONOCIDA)
  let rayos = 0

  const libreEn = (ix, iz) => {
    const i = indiceDe(ix, iz)
    if (estado[i] === DESCONOCIDA) {
      rayos += 4
      estado[i] = libre(centroX(ix), centroZ(iz), detector) ? LIBRE : BLOQUEADA
    }
    return estado[i] === LIBRE
  }

  // Celda transitable más cercana a (ix, iz), si la original está bloqueada.
  const acercarLibre = (ix, iz) => {
    if (libreEn(ix, iz)) return { ix, iz }
    for (let radio = 1; radio <= 6; radio += 1) {
      for (let dx = -radio; dx <= radio; dx += 1) {
        for (let dz = -radio; dz <= radio; dz += 1) {
          if (Math.abs(dx) !== radio && Math.abs(dz) !== radio) continue
          const nx = ix + dx
          const nz = iz + dz
          if (nx < 0 || nz < 0 || nx >= columnas || nz >= filas) continue
          if (libreEn(nx, nz)) return { ix: nx, iz: nz }
        }
      }
    }
    return null
  }

  const inicioCelda = acercarLibre(ixDe(inicio.x), izDe(inicio.z))
  const finCelda = acercarLibre(ixDe(destino.x), izDe(destino.z))
  if (!inicioCelda || !finCelda) return null

  const transitable = (ax, az, bx, bz) => {
    if (rayos > MAX_RAYOS) return false
    rayos += 1
    const dx = bx - ax
    const dz = bz - az
    const largo = Math.hypot(dx, dz)
    return !detector.bloquea(ax, az, dx, dz, Math.max(0.05, largo - RADIO_JUGADOR))
  }

  const anterior = new Int32Array(total).fill(-1)
  const visto = new Uint8Array(total)
  const cola = new Int32Array(total)
  let cabeza = 0
  let colaFin = 0

  const inicioIndice = indiceDe(inicioCelda.ix, inicioCelda.iz)
  const finIndice = indiceDe(finCelda.ix, finCelda.iz)
  visto[inicioIndice] = 1
  cola[colaFin++] = inicioIndice

  let encontrado = false
  while (cabeza < colaFin) {
    const actual = cola[cabeza++]
    if (actual === finIndice) {
      encontrado = true
      break
    }
    if (rayos > MAX_RAYOS) break
    const ix = actual % columnas
    const iz = (actual - ix) / columnas
    const ax = centroX(ix)
    const az = centroZ(iz)
    for (const [dx, dz] of DESPLAZAMIENTOS) {
      const nx = ix + dx
      const nz = iz + dz
      if (nx < 0 || nz < 0 || nx >= columnas || nz >= filas) continue
      const vecino = indiceDe(nx, nz)
      if (visto[vecino] || !libreEn(nx, nz)) continue
      if (!transitable(ax, az, centroX(nx), centroZ(nz))) continue
      visto[vecino] = 1
      anterior[vecino] = actual
      cola[colaFin++] = vecino
    }
  }

  if (!encontrado) return null

  // Reconstrucción desde el destino hasta el inicio.
  const celdas = []
  for (let i = finIndice; i !== -1; i = anterior[i]) {
    const ix = i % columnas
    const iz = (i - ix) / columnas
    celdas.push({ x: centroX(ix), z: centroZ(iz) })
    if (i === inicioIndice) break
  }
  celdas.reverse()

  // Alisado por visibilidad: se salta a cada punto lo más lejano visible.
  const puntos = [{ x: inicio.x, z: inicio.z }, ...celdas]
  const suavizada = []
  let i = 0
  while (i < puntos.length - 1) {
    let j = puntos.length - 1
    while (j > i + 1 && !visible(puntos[i].x, puntos[i].z, puntos[j].x, puntos[j].z, detector)) {
      j -= 1
    }
    suavizada.push(puntos[j])
    i = j
  }

  // Tramo final hasta el destino exacto, si es visible (evita duplicarlo).
  const ultimo = suavizada[suavizada.length - 1]
  if (
    ultimo &&
    Math.hypot(ultimo.x - destino.x, ultimo.z - destino.z) > 0.05 &&
    visible(ultimo.x, ultimo.z, destino.x, destino.z, detector)
  ) {
    suavizada.push({ x: destino.x, z: destino.z })
  }

  return suavizada.length > 0 ? suavizada : null
}
