// ============================================================
// DATOS SIMULADOS DE POPULARIDAD — Museo_Smart
// ------------------------------------------------------------
// Métricas, tendencias y ranking de popularidad del museo.
// ============================================================

const base = import.meta.env.BASE_URL || '/'
const imagenExhibicion = (archivo) => `${base.replace(/\/$/, '')}/images/exhibiciones/${archivo}`

export const metricasPopularidad = {
  visitasTotales: '3.659',
  variacionVisitas: '+14.2 % respecto al periodo anterior',
  exhibicionMasVista: 'Máscara Ceremonial',
  salaMasVista: 'Sala 3 · Patrimonio cultural',
  tiempoPromedio: '4m 32s',
  tiempoDetalle: 'Por sala de exhibición',
  tasaSatisfaccion: '94.8 %',
  satisfaccionDetalle: 'Calificación positiva de visitantes',
}

export const distribucionSalas = [
  { sala: 'Sala 1 - Pintura histórica', porcentaje: 22, visitas: 805, color: '#d4af37' },
  { sala: 'Sala 2 - Cerámica y artesanía', porcentaje: 20, visitas: 732, color: '#e5a842' },
  { sala: 'Sala 3 - Patrimonio cultural', porcentaje: 35, visitas: 1280, color: '#2a9d8f' },
  { sala: 'Sala 4 - Historia natural', porcentaje: 23, visitas: 842, color: '#e76f51' },
]

export const tendenciaVisitas = [
  { hora: '08:00', visitas: 120 },
  { hora: '10:00', visitas: 340 },
  { hora: '12:00', visitas: 580 },
  { hora: '14:00', visitas: 720 },
  { hora: '16:00', visitas: 910 },
  { hora: '18:00', visitas: 620 },
  { hora: '20:00', visitas: 369 },
]

export const rankingExhibiciones = [
  {
    puesto: 1,
    id: 1,
    nombre: 'Máscara Ceremonial',
    sala: 'Sala 3 · Patrimonio cultural',
    imagen: imagenExhibicion('mascara-ceremonial.jpg'),
    visitas: 1248,
    porcentaje: 92,
    tendencia: 18,
    calificacion: '4.9 ★',
  },
  {
    puesto: 2,
    id: 2,
    nombre: 'Fósil de Ammonite',
    sala: 'Sala 4 · Historia natural',
    imagen: imagenExhibicion('fosil-ammonite.jpg'),
    visitas: 980,
    porcentaje: 74,
    tendencia: 12,
    calificacion: '4.8 ★',
  },
  {
    puesto: 3,
    id: 4,
    nombre: 'Retrato Histórico',
    sala: 'Sala 1 · Pintura histórica',
    imagen: imagenExhibicion('retrato-historico.jpg'),
    visitas: 742,
    porcentaje: 56,
    tendencia: 8,
    calificacion: '4.7 ★',
  },
  {
    puesto: 4,
    id: 3,
    nombre: 'Vasija de Cerámica',
    sala: 'Sala 2 · Cerámica y artesanía',
    imagen: imagenExhibicion('vasija-ceramica.jpg'),
    visitas: 689,
    porcentaje: 52,
    tendencia: 5,
    calificacion: '4.6 ★',
  },
  {
    puesto: 5,
    id: 5,
    nombre: 'Textil Ancestral',
    sala: 'Sala 3 · Textiles',
    imagen: imagenExhibicion('textil-ancestral.jpg'),
    visitas: 520,
    porcentaje: 39,
    tendencia: 4,
    calificacion: '4.6 ★',
  },
  {
    puesto: 6,
    id: 6,
    nombre: 'Orfebrería Muisca',
    sala: 'Sala 4 · Metales',
    imagen: imagenExhibicion('orfebreria-muisca.jpg'),
    visitas: 495,
    porcentaje: 37,
    tendencia: -2,
    calificacion: '4.8 ★',
  },
  {
    puesto: 7,
    id: 7,
    nombre: 'Escultura Lítica',
    sala: 'Sala 4 · Piedra',
    imagen: imagenExhibicion('escultura-litica.jpg'),
    visitas: 410,
    porcentaje: 31,
    tendencia: 6,
    calificacion: '4.5 ★',
  },
  {
    puesto: 8,
    id: 8,
    nombre: 'Restos Óseos',
    sala: 'Sala 3 · Antropología',
    imagen: imagenExhibicion('restos-oseos.jpg'),
    visitas: 340,
    porcentaje: 26,
    tendencia: -1,
    calificacion: '4.4 ★',
  },
]
