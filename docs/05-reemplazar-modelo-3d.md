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

## Convención de colisiones

El visor calcula las colisiones con `raycast` contra la geometría real (BVH de
`three-mesh-bvh`), así que el modelo debe nombrar la arquitectura de forma
predecible. Se aceptan **dos convenciones**; si existen cajas `COL_*`, mandan
sobre todo lo demás.

### Opción A — prefijos de nombre (la que usa el modelo actual)

| Prefijo | Se usa para colisionar |
|---|---|
| `Muro_` | Muros interiores y exteriores. |
| `Fachada_` | Fachada y su dintel (define además la aparición del visitante). |
| `Revestimiento` | Revestimientos que forman pared (incluye `Revestimiento.001`, etc.). |
| `Division`, `Pared` | Divisiones y tabiques. |
| `Pedestal`, `Base`, `Vitrina`, `Vidrio` | Vitrinas y pedestales. |
| `Columna_`, `Pilastra_`, `Pilar_` | Columnas, pilastras y pilares estructurales. |

Las vitrinas de las exhibiciones se llaman `EXH_Sx_0y_Vidrio`, `EXH_Sx_0y_Plinto`
o `EXH_Sx_0y_Poste`; el visor las reconoce como vitrinas y también colisionan.

Nunca colisionan, aunque su nombre coincida: `InstancedMesh` (plantas y
vegetación), pisos, techos, lámparas, cables, cuadros, marcos, carteles y
cualquier malla de menos de 0,3 m de altura.

`Puerta_Hoja` y `Puerta_Vidrio` solo colisionan si están **cerradas** sobre el
vano. El visor compara la orientación del panel con el eje de la fachada: una
hoja girada perpendicular a la fachada está abierta y no frena al visitante.

### Opción B — cajas invisibles `COL_*` (recomendada para modelos nuevos)

Si el modelo trae objetos cuyo nombre empieza por `COL_` (normalmente cajas
creadas en Blender para definir el volumen de colisión), el visor **ignora el
resto de la escena para el movimiento**: solo esas cajas colisionan y se ocultan
automáticamente al cargar. Es la opción más robusta porque desacopla la
colisión del aspecto visible del modelo.

Para usarla:

1. En Blender, crear cubos llamados `COL_Pared_01`, `COL_Vitrina_S2_01`, etc.
2. Ajustar cada cubo al volumen que debe frenar al visitante (pueden solaparse).
3. Exportarlos en el mismo GLB con el resto del museo.

El visor informa en la consola de desarrollo (`[recorrido 3D] colisiones`) del
modo activo (`COL_*` o `prefijos`) y del número de mallas usadas.

## Depuración de colisiones

Abrir el recorrido añadiendo `?debug=colisiones` a la dirección **antes** del
hash, por ejemplo:

```
http://localhost:5173/?debug=colisiones#/recorrido-virtual
```

(La navegación interna usa el hash tal cual, `#/recorrido-virtual`; por eso el
parámetro va en la query real y no dentro del hash.)

Con ese parámetro:

- se dibujan en alambre verde las mallas que se usan para colisionar;
- la consola muestra `[recorrido 3D debug] bloquea: <nombre>` cada vez que un
  objeto impide avanzar (como máximo una línea por objeto y segundo);
- la consola muestra la posición actual `x, z` cada 2 segundos.

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
