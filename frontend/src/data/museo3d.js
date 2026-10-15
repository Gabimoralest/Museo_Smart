// Configuración estática del recorrido 3D del museo.
// Los nombres de nodo son los reales exportados en MuseoSmart2.glb (verificados
// inspeccionando el GLB). No hay aquí identificadores de exhibiciones del
// backend ni relaciones con la base de datos: eso queda para una fase posterior.

const base = import.meta.env.BASE_URL || '/'

// Modelo optimizado (texturas 2K/WebP + geometría Meshopt). Conserva los 89
// nodos, los 11 materiales y KHR_materials_transmission. El original
// MuseoSmart2.glb se mantiene como respaldo.
export const MODELO_URL = `${base.replace(/\/$/, '')}/MuseoSmart2.optimizado.glb`

// Piezas de exposición seleccionables, identificadas por el nombre real del
// nodo en el GLB. `id` es un identificador local y estable para esta fase; NO
// es un id de exhibición del backend.
export const PIEZAS = {
  Pintura_Sala1_1: { id: 'pintura-sala1-1', etiqueta: 'Pintura histórica 1', sala: 1 },
  Pintura_Sala1_2: { id: 'pintura-sala1-2', etiqueta: 'Pintura histórica 2', sala: 1 },
  Vasija_Azul_Blanca_Sala2_Cuerpo: {
    id: 'vasija-azul-blanca-sala2-cuerpo',
    etiqueta: 'Vasija azul y blanca (cuerpo)',
    sala: 2,
  },
  Vasija_Azul_Blanca_Sala2_Tapa: {
    id: 'vasija-azul-blanca-sala2-tapa',
    etiqueta: 'Vasija azul y blanca (tapa)',
    sala: 2,
  },
  Quemador_Incienso_Sala2: {
    id: 'quemador-incienso-sala2',
    etiqueta: 'Quemador de incienso',
    sala: 2,
  },
  Estatua_Sala3: { id: 'estatua-sala3', etiqueta: 'Estatua', sala: 3 },
  Recipiente_Elefante_Sala3: {
    id: 'recipiente-elefante-sala3',
    etiqueta: 'Recipiente del elefante',
    sala: 3,
  },
  Diente_Megalodon_Sala4: {
    id: 'diente-megalodon-sala4',
    etiqueta: 'Diente de megalodón',
    sala: 4,
  },
  Esqueleto_Triceratops_Sala4: {
    id: 'esqueleto-triceratops-sala4',
    etiqueta: 'Esqueleto de triceratops',
    sala: 4,
  },
}

// ------------------------------------------------------------
// Correspondencia entre nodos del GLB y exhibiciones del backend
// ------------------------------------------------------------
// Asocia el nombre EXACTO del nodo del modelo con el `codigo` estable de una
// exhibición devuelta por GET /api/v1/exhibiciones.
//
// ESTADO ACTUAL: TODAS las entradas están a `null` (PENDIENTE DE CONFIRMAR).
// No se ha podido demostrar ninguna correspondencia: el backend solo expone
// títulos y descripciones provisionales ([PROVISIONAL]) sin relación semántica
// con los nombres de nodo del GLB, y el propio modelo no incluye metadatos de
// vínculo (los nodos no tienen `extras`). Asignar un `codigo` por orden de
// objeto o por compartir sala sería inventar la asociación, así que no se hace.
//
// Para activar una obra, sustituya `null` por el `codigo` real, por ejemplo:
//   Pintura_Sala1_1: 'pintura-historica-01',
// Mientras el valor sea `null`, el visor muestra únicamente la identificación
// local de la pieza y NO registra visitas de popularidad para ella.
//
// Nota: `Vasija_Azul_Blanca_Sala2_Cuerpo` y `Vasija_Azul_Blanca_Sala2_Tapa`
// son dos nodos de una MISMA obra; si se confirma, ambos deben apuntar al
// mismo `codigo`.
export const EXHIBICION_POR_NODO = {
  Pintura_Sala1_1: null,
  Pintura_Sala1_2: null,
  Vasija_Azul_Blanca_Sala2_Cuerpo: null,
  Vasija_Azul_Blanca_Sala2_Tapa: null,
  Quemador_Incienso_Sala2: null,
  Estatua_Sala3: null,
  Recipiente_Elefante_Sala3: null,
  Diente_Megalodon_Sala4: null,
  Esqueleto_Triceratops_Sala4: null,
}

// La arquitectura del GLB usa prefijos consistentes. Se usan únicamente para
// generar colisiones; no se consideran piezas seleccionables.
const SIN_COLISION = /^(Plano$|Bombilla)/
const CON_COLISION = /^(Pared|Division|Marco|Puerta|Vidrio|Pedestal|Base)/

// Determina si un nodo arquitectónico debe generar colisión.
export function esColision(nombre) {
  if (!nombre || SIN_COLISION.test(nombre)) return false
  if (PIEZAS[nombre]) return false
  return CON_COLISION.test(nombre)
}

// Posición inicial dentro del museo: justo pasado el acceso oeste, en el
// pasillo central (z≈0), mirando hacia el interior (+X). Derivada de la
// geometría real del modelo (museo de 10,3 x 10,3 m con pasillo entre z=-1 y z=1).
export const APARICION = {
  x: -4,
  z: 0,
  rotacionY: -Math.PI / 2,
}

export const ALTURA_OJO = 1.6
export const VELOCIDAD = 2.8
export const SENSIBILIDAD = 0.0022
export const RADIO_JUGADOR = 0.3
export const COLOR_RESALTE = 0xd6b26a

// Límite de seguridad (las paredes ya colisionan; esto evita escapar del museo).
export const LIMITES = { xMin: -4.55, xMax: 4.55, zMin: -4.55, zMax: 4.55 }
