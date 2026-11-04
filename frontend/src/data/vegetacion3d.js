// Control visual de la vegetación del recorrido 3D.
//
// Las plantas del GLB son `InstancedMesh` (extension EXT_mesh_gpu_instancing) y
// NO participan en las colisiones: `colisiones3d.js` descarta cualquier
// InstancedMesh. Por eso ocultar instancias aquí es puramente visual y no puede
// abrir ni cerrar pasos.
//
// Dos recortes complementarios, ambos sin tocar el GLB:
//   1. Porcentaje fijo: solo se dibuja (1 - porcentaje) de las instancias. Se
//      eligen de forma determinista (por índice) para que la escena no cambie
//      de aspecto entre fotogramas.
//   2. Distancia: las instancias que quedan por encima del umbral respecto al
//      visitante se descartan en cada actualización.
//
// Three permite limitar las instancias dibujadas con `mesh.count`: las que
// quedan por encima del límite no se dibujan pero permanecen en el buffer, de
// modo que los dos recortes son O(1) de coste de dibujado.


import { Box3, Vector3 } from 'three'
import {
  VEGETACION_DISTANCIA,
  VEGETACION_OCULTA,
  esVegetacion,
} from './museo3d'

const _caja = new Box3()

// Recoge los InstancedMesh de vegetación y limita su `count` al porcentaje.
export function prepararVegetacion(raiz, porcentaje = VEGETACION_OCULTA) {
  const plantas = []
  if (!raiz) return plantas

  const ocultas = Math.min(0.95, Math.max(0, porcentaje))

  raiz.traverse((objeto) => {
    if (!objeto.isInstancedMesh) return
    if (!esVegetacion(objeto.material)) return

    const total = objeto.count
    if (total === 0) return

    // Se conserva una fracción determinista de las instancias (las primeras del
    // buffer) limitando `count`. Las restantes siguen en el buffer pero no se
    // dibujan; no se borra nada del modelo ni del GLB.
    const visibles = Math.max(1, Math.round(total * (1 - ocultas)))
    objeto.count = visibles

    // Centro de la vegetación, para el recorte por distancia.
    _caja.setFromObject(objeto)
    const centro = _caja.isEmpty()
      ? new Vector3()
      : _caja.getCenter(new Vector3())

    plantas.push({
      malla: objeto,
      total,
      visibles,
      centro,
      aplicado: visibles,
    })
  })

  return plantas
}

// Recorta por distancia respecto al visitante. `posicion` es la cámara; el
// cálculo se hace como mucho cada `intervalo` segundos para no costar por
// fotograma. Devuelve true si hubo cambios.
export function actualizarVegetacion(plantas, posicion, opciones = {}) {
  if (!plantas || plantas.length === 0) return false
  const { distancia = VEGETACION_DISTANCIA, intervalo = 0.5, ahora = 0, estado } = opciones

  // Control de cadencia: si no toca, no se recalcula.
  if (estado && ahora - estado.ultimo < intervalo) return false
  if (estado) estado.ultimo = ahora

  let cambios = false
  for (const planta of plantas) {
    const lejos = distancia > 0
      ? Math.hypot(posicion.x - planta.centro.x, posicion.z - planta.centro.z) > distancia
      : false
    const objetivo = lejos ? 0 : planta.visibles
    if (objetivo !== planta.aplicado) {
      planta.malla.count = objetivo
      planta.malla.visible = objetivo > 0
      planta.aplicado = objetivo
      cambios = true
    }
  }
  return cambios
}

// Restaura el número de instancias dibujadas (al desmontar o al cambiar opciones).
export function restaurarVegetacion(plantas) {
  if (!plantas) return
  for (const planta of plantas) {
    planta.malla.count = planta.total
    planta.malla.visible = true
    planta.aplicado = planta.total
  }
}





