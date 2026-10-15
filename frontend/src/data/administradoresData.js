// ============================================================
// DATOS SIMULADOS DE ADMINISTRADORES — Museo_Smart
// ------------------------------------------------------------
// Datos y funciones locales aisladas para la pantalla "Administradores".
// ============================================================

export const administradoresIniciales = [
  {
    id: 1,
    nombre: 'Gabs',
    avatar: 'G',
    esSuperAdmin: true,
    correo: '6gabymorales@gmail.com',
    rol: 'SuperAdmin',
    estado: 'Activo',
    fechaCreacion: '01/10/2026 09:15 a. m.',
    ultimaActualizacion: '01/10/2026 09:15 a. m.',
    permisos: [
      'Gestionar exhibiciones',
      'Monitorear eventos IoT',
      'Consultar popularidad',
    ],
  },
  {
    id: 2,
    nombre: 'Jhojan Pérez',
    avatar: 'J',
    esSuperAdmin: false,
    correo: 'jhojan.perez@museo.com',
    rol: 'Administrador',
    estado: 'Activo',
    fechaCreacion: '02/10/2026 11:20 a. m.',
    ultimaActualizacion: '05/10/2026 10:00 a. m.',
    permisos: [
      'Gestionar exhibiciones',
      'Monitorear eventos IoT',
      'Consultar popularidad',
    ],
  },
  {
    id: 3,
    nombre: 'Wilder Gómez',
    avatar: 'W',
    esSuperAdmin: false,
    correo: 'wilder.gomez@museo.com',
    rol: 'Administrador',
    estado: 'Activo',
    fechaCreacion: '03/10/2026 02:45 p. m.',
    ultimaActualizacion: '08/10/2026 04:15 p. m.',
    permisos: [
      'Gestionar exhibiciones',
      'Monitorear eventos IoT',
    ],
  },
  {
    id: 4,
    nombre: 'María López',
    avatar: 'M',
    esSuperAdmin: false,
    correo: 'maria.lopez@museo.com',
    rol: 'Administrador',
    estado: 'Inactivo',
    fechaCreacion: '28/09/2026 10:10 a. m.',
    ultimaActualizacion: '30/09/2026 12:30 p. m.',
    permisos: [
      'Consultar popularidad',
    ],
  },
  {
    id: 5,
    nombre: 'Camila Torres',
    avatar: 'C',
    esSuperAdmin: false,
    correo: 'camila.torres@museo.com',
    rol: 'Administrador',
    estado: 'Activo',
    fechaCreacion: '25/09/2026 04:30 p. m.',
    ultimaActualizacion: '01/10/2026 09:00 a. m.',
    permisos: [
      'Gestionar exhibiciones',
      'Monitorear eventos IoT',
      'Consultar popularidad',
    ],
  },
]
