// Configuración estática del recorrido 3D del museo.
//
// La relación entre las piezas del modelo y las exhibiciones del backend NO se
// define aquí: el GLB exportado desde Blender lleva, en cada nodo vacío de
// exhibición, la propiedad personalizada `exhibicion_id` (extras glTF ->
// userData en Three.js). El visor lee esos IDs del propio modelo y los cruza con
// `ubicacion3dCodigo` que devuelve la API. Así, reemplazar el GLB no exige
// tocar código.

import { Box3, Vector3 } from 'three'

const base = import.meta.env.BASE_URL || '/'

// Ruta del modelo 3D. Configurable con VITE_MODELO_3D_URL (ver .env.example);
// por defecto se sirve el modelo optimizado desde /public.
export const MODELO_URL =
  import.meta.env.VITE_MODELO_3D_URL || `${base.replace(/\/$/, '')}/MuseoSmart2.optimizado.glb`

// ---------------------------------------------------------------------------
// Colisiones
// ---------------------------------------------------------------------------
// Convención de nombres del GLB (documentada en docs/05-reemplazar-modelo-3d.md):
//
//   * La arquitectura sólida usa los prefijos Muro_, Fachada_, Revestimiento,
//     Division, Pared, Pedestal, Base, Vitrina y Vidrio; también cuentan como
//     estructura las columnas, pilastras y pilares (Columna_, Pilastra_,
//     Pilar_), que no son decoración menor.
//   * Si el modelo incluye cajas invisibles COL_* (creadas en Blender), tienen
//     prioridad absoluta: SOLO esas colisionan y el resto de la escena se ignora
//     para el movimiento. Las cajas se ocultan al cargar.
//   * Las hojas móviles de la puerta (Puerta_Hoja / Puerta_Vidrio) se excluyen:
//     en el modelo actual están abiertas, paralelas al sentido de la marcha y
//     pegadas a los laterales del vano, por lo que no tapan el hueco.
//   * Plantas (InstancedMesh), pisos, techos, lámparas, cables, cuadros y
//     decoración menor nunca colisionan; además se descarta cualquier malla de
//     menos de ALTURA_MINIMA_COLISION de alto.

export const PREFIJO_CAJA_COLISION = 'COL_'

const COLISIONABLES =
  /^(Muro_|Fachada_|Revestimiento|Division|Pared|Pedestal|Base|Vitrina|Vidrio|Columna_|Pilastra_|Pilar_)/
// Las vitrinas de las exhibiciones llevan el prefijo del nodo (`EXH_S2_01`) y el
// tipo al final: EXH_S2_01_Vidrio, EXH_S2_01_Plinto… Son vitrinas reales, así que
// también frenan al visitante aunque no empiecen por `Vidrio`/`Vitrina`.
const VITRINA_EXHIBICION = /^EXH_.+_(Vidrio|Plinto|Plinto_Moldura|Poste)$/
const HOJAS_PUERTA = /^Puerta_(Hoja|Vidrio)/
const NO_COLISIONA =
  /^(Plano$|Bombilla|Techo|Piso|Suelo|Alfombra|Inlay|Escalon|Escalón|Marco|Cuadro|Luz|Aplique|Linterna|Cadena|Baliza|Letrero|Subtitulo|Subtítulo|Placa|Cristal|Ventana|Frontón|Fronton)/

// ¿El nombre corresponde a una caja de colisión invisible de Blender?
export function esCajaColision(nombre) {
  return typeof nombre === 'string' && nombre.startsWith(PREFIJO_CAJA_COLISION)
}

// ¿El nombre corresponde a arquitectura que debe frenar al visitante?
export function esColision(nombre) {
  if (!nombre || HOJAS_PUERTA.test(nombre) || NO_COLISIONA.test(nombre)) return false
  return COLISIONABLES.test(nombre) || VITRINA_EXHIBICION.test(nombre)
}

// Alturas de los rayos horizontales: rodillas, pecho y ojos. Las dos primeras
// son las básicas para paredes; la de ojos captura obstáculos elevados que
// apoyan por encima del pecho (por ejemplo, el pedestal de la estatua central,
// que arranca a ~1,35 m). También se usa el radio del visitante.
export const ALTURAS_COLISION = [0.5, 1.3, 1.6]
export const ALTURA_MINIMA_COLISION = 0.3

// Margen alrededor de los muros exteriores para poder recorrer los jardines.
export const MARGEN_EXTERIOR = 30
// Distancia a la fachada a la que aparece el visitante. Se deja fuera del
// pórtico de entrada para que la primera vista sea la puerta completa.
export const MARGEN_ENTRADA = 5

// Aparición de emergencia mientras el modelo termina de cargar. La definitiva se
// calcula con `calcularAparicion` a partir de la geometría real.
export const APARICION_PROVISIONAL = { x: 0, z: 0, rotacionY: 0 }

export const ALTURA_OJO = 1.6
export const VELOCIDAD = 2.8
export const SENSIBILIDAD = 0.0022
export const RADIO_JUGADOR = 0.3
export const COLOR_RESALTE = 0xd6b26a

// Caja envolvente de todos los nodos que cumplen el patrón. Devuelve null si no
// hay ninguno (para poder aplicar el respaldo de "toda la escena").
function cajaDe(raiz, patron) {
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

// Límites de movimiento: caja de muros exteriores y fachadas, ampliada con un
// margen para recorrer el exterior. Si el modelo no trae esos nombres, se usa la
// caja envolvente de toda la escena.
export function calcularLimites(raiz) {
  if (!raiz) return null
  const estructura =
    cajaDe(raiz, /^(Muro_Exterior_|Fachada_)/) || new Box3().setFromObject(raiz)
  if (estructura.isEmpty()) return null
  estructura.expandByScalar(MARGEN_EXTERIOR)
  return {
    xMin: estructura.min.x,
    xMax: estructura.max.x,
    zMin: estructura.min.z,
    zMax: estructura.max.z,
  }
}

// Punto de aparición frente a la entrada principal. Criterio:
//   1. Se localiza la fachada (nodos Fachada_*) y el edificio (Muro_,
//      Revestimiento, Division, Pared) para saber hacia qué lado está el exterior.
//   2. Se toma el centro del vano de la puerta (Puerta_Hoja / Puerta_Vidrio) o,
//      si no existe, el centro de la fachada.
//   3. Se sale perpendicularmente a la fachada MARGEN_ENTRADA metros hacia fuera
//      y se orienta la cámara hacia ese centro. Así el visitante aparece delante
//      de la puerta y mirándola, sin números fijos del modelo.
export function calcularAparicion(raiz) {
  if (!raiz) return { ...APARICION_PROVISIONAL }

  const escena = new Box3().setFromObject(raiz)
  if (escena.isEmpty()) return { ...APARICION_PROVISIONAL }

  const fachada = cajaDe(raiz, /^Fachada_/)
  // Sin fachada identificable no hay forma fiable de saber dónde está el
  // exterior: se aparece en el centro de la escena mirando hacia -Z.
  if (!fachada) {
    const centro = escena.getCenter(new Vector3())
    return { x: centro.x, z: centro.z, rotacionY: 0 }
  }

  const edificio = cajaDe(raiz, /^(Muro_|Revestimiento|Division|Pared)/) || escena
  const puerta = cajaDe(raiz, /^Puerta_(Hoja|Vidrio)/)

  const centroFachada = fachada.getCenter(new Vector3())
  const centroEdificio = edificio.getCenter(new Vector3())
  const centroPuerta = puerta ? puerta.getCenter(new Vector3()) : centroFachada

  const ancho = fachada.max.x - fachada.min.x
  const fondo = fachada.max.z - fachada.min.z

  let x = centroPuerta.x
  let z = centroPuerta.z
  if (fondo <= ancho) {
    // Fachada perpendicular a Z: el exterior está del lado opuesto al edificio.
    const signo = Math.sign(centroFachada.z - centroEdificio.z) || 1
    z = signo > 0 ? fachada.max.z + MARGEN_ENTRADA : fachada.min.z - MARGEN_ENTRADA
  } else {
    // Fachada perpendicular a X.
    const signo = Math.sign(centroFachada.x - centroEdificio.x) || 1
    x = signo > 0 ? fachada.max.x + MARGEN_ENTRADA : fachada.min.x - MARGEN_ENTRADA
  }

  const dx = centroPuerta.x - x
  const dz = centroPuerta.z - z
  return {
    x,
    z,
    rotacionY: Math.atan2(-dx, -dz),
  }
}

// Clave de la propiedad personalizada que Blender incrusta en cada nodo de
// exhibición (extras glTF). El script de etiquetado y el verificador del modelo
// usan el mismo nombre.
export const CLAVE_EXHIBICION_ID = 'exhibicion_id'
