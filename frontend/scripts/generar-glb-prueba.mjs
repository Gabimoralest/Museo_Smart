// Genera un GLB de prueba mínimo y VÁLIDO con nodos vacíos etiquetados y una
// malla hija (triángulo) cada uno.
// Uso:
//   node generar-glb-prueba.mjs <salida.glb>           -> 2 nodos (EXH_S1_01, EXH_S1_02)
//   node generar-glb-prueba.mjs <salida.glb> --completo -> 12 nodos (EXH_S1_01..EXH_S6_02)
import fs from 'node:fs'

const salida = process.argv[2] || 'modelo-prueba.glb'
const completo = process.argv.includes('--completo')

// IDs a etiquetar.
const ids = completo
  ? Array.from({ length: 6 }, (_, s) => [1, 2].map((n) => `EXH_S${s + 1}_0${n}`)).flat()
  : ['EXH_S1_01', 'EXH_S1_02']

// --- Buffer binario: un triángulo por nodo (posiciones float32) ---
const posiciones = []
for (let i = 0; i < ids.length; i += 1) {
  posiciones.push(0, 0, 0, 1, 0, 0, 0, 1, 0)
}
const bufferBinario = Buffer.from(new Float32Array(posiciones).buffer)

const gltf = {
  asset: { version: '2.0', generator: 'museo-smart-test' },
  scene: 0,
  scenes: [{ nodes: ids.map((_, i) => i * 2) }],
  nodes: [],
  meshes: [],
  accessors: [],
  bufferViews: [],
  buffers: [{ byteLength: bufferBinario.length }],
}

ids.forEach((id, i) => {
  const salaId = Number(id.match(/S(\d+)_/)[1])
  gltf.nodes.push({
    name: id,
    extras: { exhibicion_id: id, sala_id: salaId, titulo: `Prueba ${id}`, tipo: 'VITRINA' },
    children: [i * 2 + 1],
  })
  gltf.nodes.push({ name: `Malla_${id}`, mesh: i })
  gltf.meshes.push({ name: `malla${i}`, primitives: [{ attributes: { POSITION: i }, mode: 4 }] })
  gltf.accessors.push({
    bufferView: i,
    componentType: 5126,
    count: 3,
    type: 'VEC3',
    min: [0, 0, 0],
    max: [1, 1, 0],
  })
  gltf.bufferViews.push({ buffer: 0, byteOffset: i * 36, byteLength: 36, target: 34962 })
})

// --- Empaquetar GLB ---
const jsonTexto = JSON.stringify(gltf)
const jsonBuf = Buffer.from(jsonTexto, 'utf8')
// El chunk JSON debe ir alineado a 4 bytes con espacios.
const rellenoJson = (4 - (jsonBuf.length % 4)) % 4
const jsonChunk = Buffer.concat([jsonBuf, Buffer.from(' '.repeat(rellenoJson))])

// El chunk BIN debe ir alineado a 4 bytes con ceros.
const rellenoBin = (4 - (bufferBinario.length % 4)) % 4
const binChunk = Buffer.concat([bufferBinario, Buffer.alloc(rellenoBin)])

const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length
const cabecera = Buffer.alloc(12)
cabecera.write('glTF', 0, 'ascii')
cabecera.writeUInt32LE(2, 4)
cabecera.writeUInt32LE(total, 8)

const chunkJsonCab = Buffer.alloc(8)
chunkJsonCab.writeUInt32LE(jsonChunk.length, 0)
chunkJsonCab.writeUInt32LE(0x4e4f534a, 4) // "JSON"

const chunkBinCab = Buffer.alloc(8)
chunkBinCab.writeUInt32LE(binChunk.length, 0)
chunkBinCab.writeUInt32LE(0x004e4942, 4) // "BIN"

fs.writeFileSync(salida, Buffer.concat([cabecera, chunkJsonCab, jsonChunk, chunkBinCab, binChunk]))
console.log(`GLB de prueba generado: ${salida} (${total} bytes)`)

