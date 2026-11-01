// Configuración estática del recorrido 3D del museo.
//
// La relación entre las piezas del modelo y las exhibiciones del backend NO se
// define aquí: el GLB exportado desde Blender lleva, en cada nodo vacío de
// exhibición, la propiedad personalizada `exhibicion_id` (extras glTF ->
// userData en Three.js). El visor lee esos IDs del propio modelo y los cruza con
// `ubicacion3dCodigo` que devuelve la API. Así, reemplazar el GLB no exige
// tocar código.

const base = import.meta.env.BASE_URL || '/'

// Ruta del modelo 3D. Configurable con VITE_MODELO_3D_URL (ver .env.example);
// por defecto se sirve el modelo optimizado desde /public.
export const MODELO_URL =
  import.meta.env.VITE_MODELO_3D_URL || `${base.replace(/\/$/, '')}/MuseoSmart2.optimizado.glb`

// La arquitectura del GLB usa prefijos consistentes. Se usan únicamente para
// generar colisiones; no se consideran piezas seleccionables.
const SIN_COLISION = /^(Plano$|Bombilla)/
const CON_COLISION = /^(Pared|Division|Marco|Puerta|Vidrio|Pedestal|Base)/

// Determina si un nodo arquitectónico debe generar colisión.
export function esColision(nombre) {
  if (!nombre || SIN_COLISION.test(nombre)) return false
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

// Clave de la propiedad personalizada que Blender incrusta en cada nodo de
// exhibición (extras glTF). El script de etiquetado y el verificador del modelo
// usan el mismo nombre.
export const CLAVE_EXHIBICION_ID = 'exhibicion_id'
