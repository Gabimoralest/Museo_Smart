// ============================================================
// DATOS SIMULADOS DEL PANEL SUPERADMIN — Museo_Smart
// ------------------------------------------------------------
// IMPORTANTE: TODOS los valores de este archivo son MOCKUPS de
// demostración para construir la interfaz visual. NO provienen del
// backend y se mantienen aislados para fácil sustitución futura.
// ============================================================

const base = import.meta.env.BASE_URL || '/'

export const imagen = (archivo) => `${base.replace(/\/$/, '')}/images/${archivo}`
export const imagenExhibicion = (archivo) => `${base.replace(/\/$/, '')}/images/exhibiciones/${archivo}`

// Recursos gráficos existentes en public/images (reutilizados).
export const imagenesPanel = {
  banner: imagen('sidebar-estatua.jpg'),
  lateral: imagen('sidebar-estatua.jpg'),
}

export const secciones = [
  { id: 'inicio', etiqueta: 'Inicio', icono: 'inicio', ruta: '#/admin' },
  { id: 'exhibiciones', etiqueta: 'Gestión de exhibiciones', icono: 'coleccion', ruta: '#/admin/exhibiciones' },
  { id: 'monitoreo', etiqueta: 'Monitoreo IoT', icono: 'sensor', ruta: '#/admin/monitoreo' },
  { id: 'alertas', etiqueta: 'Alertas', icono: 'alerta', ruta: '#/admin/alertas' },
  { id: 'popularidad', etiqueta: 'Popularidad', icono: 'analitica', ruta: '#/admin/popularidad' },
  { id: 'administradores', etiqueta: 'Administradores', icono: 'admin', soloSuperAdmin: true, corona: true, ruta: '#/admin/administradores' },
  { id: 'perfil', etiqueta: 'Mi perfil', icono: 'perfil', ruta: '#/admin/perfil' },
]

export const resumenInicio = [
  {
    id: 'exhibiciones',
    etiqueta: 'Exhibiciones',
    valor: 8,
    detalleVerde: '6 activas',
    detalleRojo: '2 inactivas',
    icono: 'templo',
    sparkline: 'oro',
    ruta: '#/admin/exhibiciones',
  },
  {
    id: 'administradores',
    etiqueta: 'Administradores',
    valor: 3,
    detalleVerde: '2 activos',
    detalleRojo: '1 inactivo',
    icono: 'usuarios',
    sparkline: 'verde',
    ruta: '#/admin/administradores',
  },
  {
    id: 'sensores',
    etiqueta: 'Sensores IoT',
    valor: 12,
    detalleVerde: '10 conectados',
    detalleRojo: '2 con alerta',
    icono: 'antena',
    sparkline: 'verde-menta',
    ruta: '#/admin/monitoreo',
  },
  {
    id: 'alertas',
    etiqueta: 'Alertas activas',
    valor: 4,
    detalleRojo: '2 críticas',
    detalleNaranja: '2 advertencias',
    icono: 'campana',
    sparkline: 'rojo',
    ruta: '#/admin/alertas',
  },
]

export const distribucionSensoresInicio = {
  total: 12,
  items: [
    { label: 'Conectados', valor: 10, porcentaje: '83 %', color: '#2a9d8f' },
    { label: 'Advertencia', valor: 1, porcentaje: '8 %', color: '#e5a842' },
    { label: 'Crítico', valor: 1, porcentaje: '8 %', color: '#e76f51' },
    { label: 'Desconectados', valor: 0, porcentaje: '0 %', color: '#9e9e9e' },
  ],
}

export const alertasRecientesInicio = [
  {
    id: 1,
    tipo: 'critica',
    icono: 'termometro',
    titulo: 'Temperatura fuera de rango',
    sala: 'Sala 4 · Sensor ambiental',
    hace: 'Hoy, 10:24',
    badge: 'Crítica',
  },
  {
    id: 2,
    tipo: 'advertencia',
    icono: 'gota',
    titulo: 'Humedad elevada',
    sala: 'Sala 2 · Sensor ambiental',
    hace: 'Hoy, 09:17',
    badge: 'Advertencia',
  },
  {
    id: 3,
    tipo: 'advertencia',
    icono: 'wifi',
    titulo: 'Sensor sin lecturas',
    sala: 'Sala 3 · Sensor ambiental',
    hace: 'Hoy, 08:40',
    badge: 'Advertencia',
  },
  {
    id: 4,
    tipo: 'critica',
    icono: 'termometro',
    titulo: 'Temperatura baja',
    sala: 'Sala 1 · Sensor ambiental',
    hace: 'Ayer, 18:30',
    badge: 'Crítica',
  },
]

export const exhibicionesPopularesInicio = [
  {
    puesto: 1,
    nombre: 'Máscara Ceremonial',
    sala: 'Sala 3 · Patrimonio cultural',
    visitas: '1.248',
    imagen: imagenExhibicion('mascara-ceremonial.jpg'),
    porcentaje: 82,
  },
  {
    puesto: 2,
    nombre: 'Fósil de Ammonite',
    sala: 'Sala 4 · Historia natural',
    visitas: '980',
    imagen: imagenExhibicion('fosil-ammonite.jpg'),
    porcentaje: 65,
  },
  {
    puesto: 3,
    nombre: 'Retrato Histórico',
    sala: 'Sala 1 · Pintura histórica',
    visitas: '742',
    imagen: imagenExhibicion('retrato-historico.jpg'),
    porcentaje: 49,
  },
  {
    puesto: 4,
    nombre: 'Vasija de Cerámica',
    sala: 'Sala 2 · Cerámica y artesanía',
    visitas: '689',
    imagen: imagenExhibicion('vasija-ceramica.jpg'),
    porcentaje: 46,
  },
]

export const actividadRecienteInicio = [
  {
    id: 1,
    icono: 'lapiz',
    accion: 'Se activó la exhibición',
    elemento: 'Vasija de Cerámica',
    hace: 'Hoy, 11:20',
    autor: 'Gabs',
  },
  {
    id: 2,
    icono: 'usuarios',
    accion: 'Se creó un administrador',
    elemento: 'Laura Méndez',
    hace: 'Hoy, 10:05',
    autor: 'Gabs',
  },
  {
    id: 3,
    icono: 'bloqueo',
    accion: 'Se desactivó la exhibición',
    elemento: 'Máscara Ceremonial',
    hace: 'Ayer, 16:42',
    autor: 'Gabs',
  },
  {
    id: 4,
    icono: 'galeria',
    accion: 'Se actualizó contenido multimedia de',
    elemento: 'Retrato Histórico',
    hace: 'Ayer, 14:18',
    autor: 'Gabs',
  },
]

// Compatibilidad con imports antiguos
export const resumen = resumenInicio
export const estadoSensores = []
export const alertasRecientes = alertasRecientesInicio
export const exhibicionesPopulares = exhibicionesPopularesInicio
export const actividadReciente = actividadRecienteInicio
export const accesosRapidos = []
