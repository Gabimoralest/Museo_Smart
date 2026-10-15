// Reproduce la ruta de carga real con three-stdlib GLTFLoader + su MeshoptDecoder.
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const SRC = process.argv[2] || 'public/MuseoSmart2.optimizado.glb'
const t = (p) => pathToFileURL(new URL(p, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href

const three = await import(t('./node_modules/three/build/three.module.js'))
void three
const { GLTFLoader } = await import(t('./node_modules/three-stdlib/loaders/GLTFLoader.cjs'))
const { MeshoptDecoder } = await import(t('./node_modules/three-stdlib/libs/MeshoptDecoder.js'))

globalThis.self = globalThis
globalThis.window = globalThis
globalThis.document = {
  createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {} }),
  createElement: () => ({ style: {}, getContext: () => null }),
}

const loader = new GLTFLoader()
loader.setMeshoptDecoder(MeshoptDecoder())

const buf = fs.readFileSync(new URL(SRC, import.meta.url))
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

const parseAsync = () => new Promise((res, rej) => {
  try { loader.parse(ab, '', res, rej) } catch (e) { rej(e) }
})

try {
  const gltf = await Promise.race([
    parseAsync(),
    new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT 30s')), 30000)),
  ])
  let meshes = 0, verts = 0
  const nombres = []
  gltf.scene.traverse((o) => { if (o.isMesh) { meshes++; verts += o.geometry.attributes.position.count; nombres.push(o.name) } })
  console.log(`OK: ${meshes} meshes, ${verts} vértices`)
  console.log('piezas clave presentes:', ['Estatua_Sala3', 'Esqueleto_Triceratops_Sala4'].every((n) => nombres.includes(n)))
} catch (e) {
  console.log('ERROR AL CARGAR:', e.message)
  if (e.stack) console.log(e.stack.split('\n').slice(0, 8).join('\n'))
}
