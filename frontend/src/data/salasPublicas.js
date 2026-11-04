// Datos de presentación de las salas públicas de la portada.
//
// Las salas en sí vienen de la API (GET /api/v1/salas); aquí solo se resuelven
// las rutas de imagen y las etiquetas de presentación. Las portadas viven en
// `public/salas/` con el nombre del `codigo3d` de cada sala (SALA_1 … SALA_6).

const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')

// Imagen del hero (no depende de la API).
export const HERO_IMAGEN = `${base}/images/museo-hero.png`

// Formatos admitidos para la portada de una sala. Se prueban en orden: así
// funciona aunque las imágenes 5 y 6 se añadan en otro formato.
const FORMATOS = ['png', 'jpg', 'jpeg', 'webp']

// Lista de rutas candidatas para la portada de una sala. Devuelve [] si la sala
// no trae `codigo3d`; en ese caso el componente muestra el marcador neutro.
export function portadasDeSala(codigo3d) {
  if (!codigo3d) return []
  return FORMATOS.map((formato) => `${base}/salas/${codigo3d}.${formato}`)
}

// Nombre visible de la sala: el que devuelve la API, en mayúsculas para las
// etiquetas de la cabecera del hero.
export function nombreSalaMayusculas(sala) {
  const nombre = typeof sala?.nombre === 'string' ? sala.nombre.trim() : ''
  return nombre.toUpperCase()
}

// Ordena las salas por el campo `orden` (y por id como desempate), sin mutar el
// array original.
export function ordenarSalas(salas) {
  if (!Array.isArray(salas)) return []
  return [...salas].sort((a, b) => {
    const oa = Number(a?.orden)
    const ob = Number(b?.orden)
    if (Number.isFinite(oa) && Number.isFinite(ob) && oa !== ob) return oa - ob
    if (Number.isFinite(oa) && !Number.isFinite(ob)) return -1
    if (!Number.isFinite(oa) && Number.isFinite(ob)) return 1
    return Number(a?.id ?? 0) - Number(b?.id ?? 0)
  })
}
