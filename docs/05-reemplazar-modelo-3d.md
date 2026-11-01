# Reemplazar el modelo 3D del recorrido

El recorrido 3D se conecta con el backend **leyendo los IDs que lleva el propio
modelo**. Cada exhibición es un nodo vacío de Blender llamado igual que su ID
(`EXH_S1_01` … `EXH_S6_02` + `EXH_CENTRO_01`) con una propiedad personalizada `exhibicion_id`
que Blender exporta como `extras` glTF (en Three.js: `userData.exhibicion_id`).
Las mallas (vidrio, lienzo, modelo, plinto) van como **hijas** de ese vacío.

El visor pide `GET /api/v1/exhibiciones` y cruza `ubicacion3dCodigo` con el
`exhibicion_id` de cada nodo. Por eso **reemplazar el GLB no requiere tocar
código**: basta con que el nuevo modelo respete el contrato de abajo.

## Contrato del modelo

| Elemento | Requisito |
|---|---|
| Nodo de exhibición | Vacío llamado `EXH_S1_01` … `EXH_S6_02`, más `EXH_CENTRO_01` (estatua central). |
| Propiedad personalizada | `exhibicion_id` = el mismo texto del nombre (`EXH_S1_01`). |
| Mallas de la pieza | Hijas del nodo vacío (no hermanas). |
| Salas | Vacíos `SALA_1` … `SALA_6`. |
| IDs únicos | No puede repetirse ningún `EXH_*`. |

## Pasos

### 1. Etiquetar en Blender

Con el script del proyecto de Blender (`etiquetar_exhibiciones.py`):

1. Por cada exhibición, crear un **Empty** llamado `EXH_Sx_0y`.
2. Añadir la propiedad personalizada `exhibicion_id` (tipo texto) con el mismo
   valor del nombre. Opcionalmente `sala_id`, `titulo` y `tipo`.
3. Hacer **parent** de todas las mallas de la pieza (vidrio, lienzo, modelo,
   plinto) a ese Empty.

### 2. Exportar desde Blender

Exportar como **glTF 2.0 (.glb)** marcando:

- `Include → Custom Properties` (para que viajen los `extras`).
- `Include → Empty` / jerarquía completa (para conservar los vacíos y sus hijos).

### 3. Optimizar sin perder extras ni nodos vacíos

Objetivo: reducir peso preservando `extras` y los nodos vacíos.

- **gltfpack**: `gltfpack -i MuseoSmart2.glb -o MuseoSmart2.optimizado.glb -kn -ke`
  - `-kn` conserva los nombres de nodo.
  - `-ke` conserva `extras` (las propiedades personalizadas).
- **gltf-transform**: usar un pipeline **sin** `flatten()` ni `join()`, que
  aplanarían/eliminarían los vacíos y romperían la conexión. Ejemplo:
  `gltf-transform optimize entrada.glb salida.glb --compress meshopt --texture-compress webp`
  (revisar la ayuda de la versión instalada; **no** incluir `flatten`/`join`).

### 4. Verificar el contrato

```powershell
cd frontend
npm run verificar:modelo -- ruta\al\modelo.glb
```

- Salida `OK: 13 exhibiciones etiquetadas, sin repetidos.` → listo.
- Si faltan/sobran/duplican IDs, el script lista cuáles y sale con código 1.

El script funciona con modelos comprimidos con Meshopt/Draco porque solo lee el
chunk JSON del GLB (no la geometría, sin WebGL).

### 5. Copiar al frontend

```powershell
Copy-Item ruta\al\modelo.glb frontend\public\MuseoSmart2.optimizado.glb -Force
```

El visor lo carga desde `/MuseoSmart2.optimizado.glb` (o desde la ruta que
definas en `VITE_MODELO_3D_URL`, ver `frontend/.env.example`).

### 6. Comprobar en el navegador

1. `npm run dev` en `frontend` y `.\mvnw.cmd spring-boot:run` en `backend`.
2. Abrir `#/recorrido-virtual`.
3. En la consola de desarrollo aparece un resumen:
   `[recorrido 3D] resumen modelo/API` con los IDs del modelo sin exhibición,
   las exhibiciones activas sin nodo y los IDs duplicados.

## Modelo actual (sin etiquetar)

El GLB actual (`frontend/public/MuseoSmart2.optimizado.glb`) **no** trae
`extras.exhibicion_id`, por lo que `npm run verificar:modelo` informa de que no
hay IDs y el visor carga sin errores pero no conecta piezas. Es el
comportamiento esperado hasta etiquetar y exportar el modelo nuevo.

## Nota sobre el GLB duplicado

Hay dos copias del modelo en el repositorio:

- `frontend/MuseoSmart2.glb` (~61 MB): **no la usa el visor**.
- `frontend/public/MuseoSmart2.optimizado.glb` (~11 MB): **esta es la que carga**
  el visor (`museo3d.js`, `MODELO_URL`).

Se mantiene la copia de `frontend/` como respaldo manual del original; puede
eliminarse cuando se confirme que no se necesita.
