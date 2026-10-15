// ============================================================
// DATOS SIMULADOS DE EXHIBICIONES — Museo_Smart
// ------------------------------------------------------------
// Datos locales aislados para la pantalla "Gestión de exhibiciones".
// Representa con fidelidad las 8 piezas de la referencia visual.
// ============================================================

const base = import.meta.env.BASE_URL || '/'

export const imagenExhibicion = (archivo) =>
  `${base.replace(/\/$/, '')}/images/exhibiciones/${archivo}`

export const exhibicionesIniciales = [
  {
    id: 'exh-01',
    nombre: 'Máscara Ceremonial',
    salaId: 1,
    sala: 'Sala 1',
    subtitulo: 'Sala 1 · Cultura Precolombina',
    categoria: 'Cultura Precolombina',
    descripcion:
      'Máscara ritual elaborada en oro, representa el poder espiritual de la cultura Muisca.',
    activa: true,
    imagen: imagenExhibicion('01-mascara-ceremonial.jpg'),
  },
  {
    id: 'exh-02',
    nombre: 'Fósil de Ammonite',
    salaId: 2,
    sala: 'Sala 2',
    subtitulo: 'Sala 2 · Historia Natural',
    categoria: 'Historia Natural',
    descripcion:
      'Fósil marino del período Jurásico que muestra la evolución de la vida en la Tierra.',
    activa: true,
    imagen: imagenExhibicion('02-fosil-ammonite.jpg'),
  },
  {
    id: 'exh-03',
    nombre: 'Vasija de Cerámica',
    salaId: 2,
    sala: 'Sala 2',
    subtitulo: 'Sala 2 · Cerámica y artesanía',
    categoria: 'Cerámica y artesanía',
    descripcion:
      'Pieza de cerámica elaborada por comunidades indígenas del valle del Cauca.',
    activa: false,
    imagen: imagenExhibicion('03-vasija-ceramica.jpg'),
  },
  {
    id: 'exh-04',
    nombre: 'Retrato Histórico',
    salaId: 1,
    sala: 'Sala 1',
    subtitulo: 'Sala 1 · Pintura histórica',
    categoria: 'Pintura histórica',
    descripcion:
      'Obra que representa a una figura clave en la historia nacional.',
    activa: true,
    imagen: imagenExhibicion('04-retrato-historico.jpg'),
  },
  {
    id: 'exh-05',
    nombre: 'Textil Ancestral',
    salaId: 3,
    sala: 'Sala 3',
    subtitulo: 'Sala 3 · Textiles',
    categoria: 'Textiles',
    descripcion:
      'Tejido tradicional elaborado con técnicas ancestrales.',
    activa: true,
    imagen: imagenExhibicion('05-textil-ancestral.jpg'),
  },
  {
    id: 'exh-06',
    nombre: 'Orfebrería Muisca',
    salaId: 4,
    sala: 'Sala 4',
    subtitulo: 'Sala 4 · Metales',
    categoria: 'Metales',
    descripcion:
      'Pieza en oro que simboliza la conexión con lo sagrado.',
    activa: false,
    imagen: imagenExhibicion('06-orfebreria-muisca.jpg'),
  },
  {
    id: 'exh-07',
    nombre: 'Escultura Lítica',
    salaId: 4,
    sala: 'Sala 4',
    subtitulo: 'Sala 4 · Piedra',
    categoria: 'Piedra',
    descripcion:
      'Escultura tallada en piedra, representa símbolos rituales.',
    activa: true,
    imagen: imagenExhibicion('07-escultura-litica.jpg'),
  },
  {
    id: 'exh-08',
    nombre: 'Restos Óseos',
    salaId: 3,
    sala: 'Sala 3',
    subtitulo: 'Sala 3 · Antropología',
    categoria: 'Antropología',
    descripcion:
      'Restos óseos que aportan información sobre la vida cotidiana.',
    activa: true,
    imagen: imagenExhibicion('08-restos-oseos.jpg'),
  },
]

export const OPCIONES_SALA = [
  { valor: 'todas', etiqueta: 'Todas las salas' },
  { valor: 'Sala 1', etiqueta: 'Sala 1 · Pintura histórica' },
  { valor: 'Sala 2', etiqueta: 'Sala 2 · Cerámica / Historia' },
  { valor: 'Sala 3', etiqueta: 'Sala 3 · Textiles / Antropología' },
  { valor: 'Sala 4', etiqueta: 'Sala 4 · Metales / Escultura' },
]

export const OPCIONES_ESTADO = [
  { valor: 'todos', etiqueta: 'Todos los estados' },
  { valor: 'activas', etiqueta: 'Solo activas' },
  { valor: 'inactivas', etiqueta: 'Solo inactivas' },
]

export const OPCIONES_ORDEN = [
  { valor: 'nombre-asc', etiqueta: 'Nombre (A - Z)' },
  { valor: 'nombre-desc', etiqueta: 'Nombre (Z - A)' },
  { valor: 'sala-asc', etiqueta: 'Sala (1 - 4)' },
  { valor: 'estado-activas', etiqueta: 'Estado (Activas primero)' },
  { valor: 'estado-inactivas', etiqueta: 'Estado (Inactivas primero)' },
]
