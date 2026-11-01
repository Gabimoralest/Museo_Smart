#!/usr/bin/env node
// ============================================================
// Verificador del modelo 3D — Museo Smart
// ------------------------------------------------------------
// Lee un GLB SIN WebGL: abre el contenedor binario glTF, decodifica el
// primer chunk JSON y busca los nodos que llevan la propiedad personalizada
// `extras.exhibicion_id` (la que escribe etiquetar_exhibiciones.py en Blender).
//
// No necesita three.js ni GPU: así funciona igual con modelos comprimidos con
// Meshopt (EXT_meshopt_compression) o Draco, porque solo inspecciona el JSON
// de la escena, no la geometría.
//
// Uso:
//   node scripts/verificar-modelo.mjs [ruta.glb]
// Por defecto analiza public/MuseoSmart2.optimizado.glb.
//
// Códigos esperados: EXH_S1_01 .. EXH_S6_02 (12 en total, sin repetidos).
// Sale con código 1 si faltan, sobran o se repiten IDs.
// ============================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')

const CLAVE = 'exhibicion_id'

// Esperado: 6 salas x 2 exhibiciones + la estatua central (EXH_CENTRO_01).
const ESPERADOS = []
for (let sala = 1; sala <= 6; sala += 1) {
  for (let n = 1; n <= 2; n += 1) {
    ESPERADOS.push(`EXH_S${sala}_0${n}`)
  }
}
ESPERADOS.push('EXH_CENTRO_01')

function rutaPorDefecto() {
  const candidatos = [
    path.join(RAIZ, 'public', 'MuseoSmart2.optimizado.glb'),
    path.join(RAIZ, 'public', 'MuseoSmart2.glb'),
  ]
  return candidatos.find((c) => fs.existsSync(c)) ?? candidatos[0]
}

// Devuelve { gltf, json } o lanza un Error legible.
function leerGlb(ruta) {
  const buf = fs.readFileSync(ruta)

  if (buf.length < 12) throw new Error('El archivo es demasiado pequeño para ser un GLB.')

  const magic = buf.toString('ascii', 0, 4)
  if (magic !== 'glTF') {
    throw new Error(`Cabecera GLB no válida (se esperaba "glTF", se leyó "${magic}").`)
  }

  const version = buf.readUInt32LE(4)
  if (version !== 2) {
    throw new Error(`Versión glTF no soportada: ${version} (se esperaba 2).`)
  }

  const total = buf.readUInt32LE(8)
  if (total > buf.length) {
    throw new Error('El GLB está truncado (longitud declarada mayor que el archivo).')
  }

  // Chunk 0 = JSON. Formato: [length u32][type u32 = 0x4E4F534A "JSON"][datos]
  const chunkLen = buf.readUInt32LE(12)
  const chunkType = buf.readUInt32LE(16)
  if (chunkType !== 0x4e4f534a) {
    throw new Error('El primer chunk del GLB no es JSON.')
  }
  if (20 + chunkLen > buf.length) {
    throw new Error('El chunk JSON del GLB está truncado.')
  }

  const texto = buf.toString('utf8', 20, 20 + chunkLen)
  let json
  try {
    json = JSON.parse(texto)
  } catch (e) {
    throw new Error(`El chunk JSON del GLB no se pudo parsear: ${e.message}`)
  }

  return { json }
}

// Recorre `nodes` y devuelve los que tienen extras.exhibicion_id.
// Incluye el nombre del nodo para dar contexto en la salida.
function nodosEtiquetados(json) {
  const nodos = Array.isArray(json.nodes) ? json.nodes : []
  const encontrados = []
  nodos.forEach((nodo, indice) => {
    const id = nodo?.extras?.[CLAVE]
    if (typeof id === 'string' && id.trim()) {
      encontrados.push({ id: id.trim(), nombre: nodo.name ?? `(nodo ${indice})`, indice })
    }
  })
  return encontrados
}

function main() {
  const ruta = process.argv[2] ? path.resolve(process.argv[2]) : rutaPorDefecto()

  console.log('Verificador del modelo 3D — Museo Smart')
  console.log(`Archivo: ${ruta}`)

  if (!fs.existsSync(ruta)) {
    console.error(`ERROR: no existe el archivo ${ruta}`)
    process.exitCode = 1
    return
  }

  let json
  try {
    ;({ json } = leerGlb(ruta))
  } catch (e) {
    console.error(`ERROR: ${e.message}`)
    process.exitCode = 1
    return
  }

  const totalNodos = Array.isArray(json.nodes) ? json.nodes.length : 0
  const extensiones = Array.isArray(json.extensionsUsed) ? json.extensionsUsed : []
  const etiquetados = nodosEtiquetados(json)

  console.log(`Nodos totales: ${totalNodos}`)
  if (extensiones.length) console.log(`Extensiones usadas: ${extensiones.join(', ')}`)
  console.log(`Nodos con extras.${CLAVE}: ${etiquetados.length}`)

  if (etiquetados.length === 0) {
    console.log('')
    console.log('RESULTADO: el modelo NO tiene IDs de exhibición (extras.exhibicion_id).')
    console.log('Es lo esperado para el modelo actual sin etiquetar. El visor cargará')
    console.log('sin errores y no conectará piezas. Etiqueta el modelo en Blender para')
    console.log('que el recorrido se conecte con el backend.')
    // Sin etiquetas no es un error fatal para el modelo actual: se informa y
    // se devuelve 1 porque el contrato del script es "falla si no cumple".
    process.exitCode = 1
    return
  }

  // Duplicados
  const conteo = new Map()
  for (const n of etiquetados) conteo.set(n.id, (conteo.get(n.id) ?? 0) + 1)
  const duplicados = [...conteo.entries()].filter(([, c]) => c > 1).map(([id, c]) => ({ id, c }))

  const presentes = new Set(conteo.keys())
  const faltantes = ESPERADOS.filter((id) => !presentes.has(id))
  const esperadosSet = new Set(ESPERADOS)
  const sobrantes = [...presentes].filter((id) => !esperadosSet.has(id)).sort()

  const ok = faltantes.length === 0 && sobrantes.length === 0 && duplicados.length === 0

  console.log('')
  console.log('IDs detectados:')
  for (const n of etiquetados.sort((a, b) => a.id.localeCompare(b.id))) {
    console.log(`  - ${n.id}  (nodo "${n.nombre}")`)
  }

  if (faltantes.length) {
    console.log('')
    console.log(`FALTAN (${faltantes.length}): ${faltantes.join(', ')}`)
  }
  if (sobrantes.length) {
    console.log('')
    console.log(`SOBRAN / no esperados (${sobrantes.length}): ${sobrantes.join(', ')}`)
  }
  if (duplicados.length) {
    console.log('')
    console.log('DUPLICADOS:')
    for (const d of duplicados) console.log(`  - ${d.id} aparece ${d.c} veces`)
  }

  console.log('')
  if (ok) {
    console.log(`OK: ${ESPERADOS.length} exhibiciones etiquetadas, sin repetidos.`)
    process.exitCode = 0
  } else {
    console.log('RESULTADO: el modelo NO cumple el contrato (ver faltantes/sobrantes/duplicados).')
    process.exitCode = 1
  }
}

main()
