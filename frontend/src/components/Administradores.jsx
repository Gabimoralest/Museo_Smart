import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  IconoUsuarios,
  IconoAdmin,
  IconoEscudo,
  IconoCorona,
  IconoPlus,
  IconoEditar,
  IconoBasura,
  IconoCruz,
  IconoCalendario,
  IconoReloj,
  IconoSobre,
  IconoAdvertencia,
  IconoCheck,
  IconoBloqueo,
} from './iconos'
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  eliminarUsuario,
} from '../data/usuariosApi'
import { ErrorHttp } from '../data/httpClient'
import './Administradores.css'

// ------------------------------------------------------------------
// Mapeo del DTO real (UsuarioAdminResponse) al formato que ya usan la
// tabla y el panel de detalle. La interfaz usa etiquetas visuales en
// español, pero el backend usa 'SUPERADMIN'/'ADMIN' y
// 'ACTIVO'/'INACTIVO'/'BLOQUEADO'. Se conserva el valor original en
// los campos *Backend para no perder información.
// ------------------------------------------------------------------

function formatearFecha(iso) {
  if (!iso) return '—'
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function etiquetaRol(rol) {
  if (rol === 'SUPERADMIN') return 'SuperAdmin'
  if (rol === 'ADMIN') return 'Administrador'
  return rol || '—'
}

function etiquetaEstado(estado) {
  if (estado === 'ACTIVO') return 'Activo'
  if (estado === 'INACTIVO') return 'Inactivo'
  if (estado === 'BLOQUEADO') return 'Bloqueado'
  return estado || '—'
}

function mapearUsuario(dto) {
  const nombre = dto.nombre ?? ''
  return {
    id: dto.id,
    nombre,
    avatar: nombre.trim().charAt(0).toUpperCase() || '?',
    esSuperAdmin: dto.rol === 'SUPERADMIN',
    correo: dto.correo ?? '',
    rol: etiquetaRol(dto.rol),
    rolBackend: dto.rol ?? '',
    estado: etiquetaEstado(dto.estado),
    estadoBackend: dto.estado ?? '',
    primerInicioSesion: Boolean(dto.primerInicioSesion),
    fechaCreacion: formatearFecha(dto.creadoEn),
    ultimaActualizacion: formatearFecha(dto.actualizadoEn),
    ultimoAcceso: formatearFecha(dto.ultimoAccesoEn),
  }
}

// Mensaje claro según el tipo de error del cliente HTTP compartido.
function mensajeDeError(error, porDefecto) {
  if (error instanceof ErrorHttp) {
    if (error.tipo === 'conexion') {
      return 'No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.'
    }
    if (error.tipo === 'autorizacion') {
      return 'Tu sesión ha expirado o no tienes permisos para esta acción. Inicia sesión de nuevo.'
    }
    return error.message || porDefecto
  }
  return porDefecto
}

// Mensaje específico al crear una cuenta.
function mensajeCreacion(error) {
  if (error instanceof ErrorHttp) {
    if (error.estado === 409) {
      return 'Ya existe un administrador con ese correo electrónico.'
    }
    if (error.estado === 400) {
      if (error.erroresValidacion && Object.keys(error.erroresValidacion).length > 0) {
        return Object.values(error.erroresValidacion).join(' ')
      }
      return error.message || 'Revisa los datos introducidos.'
    }
  }
  return mensajeDeError(error, 'No se pudo crear el administrador. Inténtalo de nuevo.')
}

// Mensaje específico para edición / cambio de estado / eliminación, con
// tratamiento del 409 (correo duplicado), 400 (regla de negocio, p. ej.
// proteger al último SUPERADMIN) y 404.
function mensajeOperacion(error, porDefecto) {
  if (error instanceof ErrorHttp) {
    if (error.estado === 409) {
      return 'Ya existe un administrador con ese correo electrónico.'
    }
    if (error.estado === 404) {
      return 'El administrador ya no existe. Actualiza la lista.'
    }
    if (error.estado === 400) {
      if (error.erroresValidacion && Object.keys(error.erroresValidacion).length > 0) {
        return Object.values(error.erroresValidacion).join(' ')
      }
      return error.message || 'La operación no está permitida.'
    }
  }
  return mensajeDeError(error, porDefecto)
}

export default function Administradores({ sesion: _sesion }) {
  const [admins, setAdmins] = useState([])
  const [adminSeleccionadoId, setAdminSeleccionadoId] = useState(null)
  const [drawerAbierto, setDrawerAbierto] = useState(true)

  // Estado de la consulta real al backend.
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)

  // Mensaje de éxito tras crear una cuenta.
  const [avisoExito, setAvisoExito] = useState(null)

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [filtroRol, setFiltroRol] = useState('Todos')
  const [filtroOrden, setFiltroOrden] = useState('recientes')

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1)
  const elementosPorPagina = 10

  // Modales
  const [modalCrear, setModalCrear] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalEliminar, setModalEliminar] = useState(false)

  // Form states
  const [formNombre, setFormNombre] = useState('')
  const [formCorreo, setFormCorreo] = useState('')
  const [formContrasena, setFormContrasena] = useState('')
  const [formRol, setFormRol] = useState('Administrador')

  // Estado del envío de creación.
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState(null)
  const enviandoRef = useRef(false)

  // Estado del envío de edición / cambio de estado / eliminación.
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [errorEditar, setErrorEditar] = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState(null)
  const [estadosEnCurso, setEstadosEnCurso] = useState(() => new Set())
  const operandoRef = useRef(false)

  // Carga del listado real desde el backend.
  const cargarAdministradores = useCallback(async (signal) => {
    setCargando(true)
    setErrorCarga(null)
    try {
      const datos = await listarUsuarios({ signal })
      setAdmins((datos || []).map(mapearUsuario))
    } catch (error) {
      if (error?.name === 'AbortError') return
      setErrorCarga(mensajeDeError(error, 'No se pudieron cargar los administradores.'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    const controlador = new AbortController()
    cargarAdministradores(controlador.signal)
    return () => controlador.abort()
  }, [cargarAdministradores])

  // Contadores dinámicos
  const totalAdmins = admins.length
  const activosAdmins = useMemo(() => admins.filter((a) => a.estado === 'Activo').length, [admins])
  const inactivosAdmins = useMemo(() => admins.filter((a) => a.estado === 'Inactivo').length, [admins])
  const superAdminCount = useMemo(() => admins.filter((a) => a.rol === 'SuperAdmin').length, [admins])

  const porcActivos = totalAdmins ? Math.round((activosAdmins / totalAdmins) * 100) : 0
  const porcInactivos = totalAdmins ? Math.round((inactivosAdmins / totalAdmins) * 100) : 0

  // Filtrado y ordenamiento
  const adminsFiltrados = useMemo(() => {
    let lista = admins.filter((item) => {
      if (filtroEstado !== 'Todos' && item.estado !== filtroEstado) return false
      if (filtroRol !== 'Todos' && item.rol !== filtroRol) return false
      return true
    })

    if (filtroOrden === 'nombre') {
      lista = [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre))
    }
    return lista
  }, [admins, filtroEstado, filtroRol, filtroOrden])

  const totalPaginas = Math.ceil(adminsFiltrados.length / elementosPorPagina) || 1
  const indiceInicio = (paginaActual - 1) * elementosPorPagina
  const adminsPaginados = adminsFiltrados.slice(
    indiceInicio,
    indiceInicio + elementosPorPagina,
  )

  const adminSeleccionado = useMemo(
    () => admins.find((a) => a.id === adminSeleccionadoId) || adminsFiltrados[0] || null,
    [admins, adminSeleccionadoId, adminsFiltrados],
  )

  const abrirCrear = () => {
    setFormNombre('')
    setFormCorreo('')
    setFormContrasena('')
    setErrorCrear(null)
    setModalCrear(true)
  }

  const cerrarCrear = () => {
    if (creando) return
    setModalCrear(false)
    setErrorCrear(null)
  }

  // Valida los campos obligatorios antes de enviar.
  const validarCreacion = () => {
    if (!formNombre.trim()) return 'El nombre completo es obligatorio.'
    if (!formCorreo.trim()) return 'El correo electrónico es obligatorio.'
    if (formContrasena.length < 8) {
      return 'La contraseña inicial debe tener al menos 8 caracteres.'
    }
    return null
  }

  const guardarNuevo = async (e) => {
    e.preventDefault()
    if (enviandoRef.current) return

    const validacion = validarCreacion()
    if (validacion) {
      setErrorCrear(validacion)
      return
    }

    enviandoRef.current = true
    setCreando(true)
    setErrorCrear(null)

    try {
      const creado = await crearUsuario({
        nombre: formNombre.trim(),
        correo: formCorreo.trim(),
        contrasena: formContrasena,
      })

      setModalCrear(false)
      setFormNombre('')
      setFormCorreo('')
      setFormContrasena('')
      setAvisoExito(
        creado?.nombre
          ? `Administrador «${creado.nombre}» creado correctamente.`
          : 'Administrador creado correctamente.',
      )
      // Recarga real del listado; si marca un id, se selecciona la nueva cuenta.
      if (creado?.id != null) {
        setAdminSeleccionadoId(creado.id)
      }
      await cargarAdministradores()
    } catch (error) {
      // Se conservan los datos introducidos para permitir un nuevo intento.
      setErrorCrear(mensajeCreacion(error))
    } finally {
      setCreando(false)
      enviandoRef.current = false
      setTimeout(() => setAvisoExito(null), 4000)
    }
  }

  const abrirEditar = (adm) => {
    const objetivo = adm || adminSeleccionado
    if (!objetivo) return
    setFormNombre(objetivo.nombre)
    setFormCorreo(objetivo.correo)
    setFormRol(objetivo.rol)
    setErrorEditar(null)
    setAdminSeleccionadoId(objetivo.id)
    setModalEditar(true)
  }

  const cerrarEditar = () => {
    if (guardandoEdicion) return
    setModalEditar(false)
    setErrorEditar(null)
  }

  const guardarEdicion = async (e) => {
    e.preventDefault()
    if (!adminSeleccionado || guardandoEdicion) return

    if (!formNombre.trim() || !formCorreo.trim()) {
      setErrorEditar('El nombre y el correo son obligatorios.')
      return
    }

    setGuardandoEdicion(true)
    setErrorEditar(null)
    try {
      // El backend solo actualiza nombre y correo (el rol no cambia).
      const actualizado = await actualizarUsuario(adminSeleccionado.id, {
        nombre: formNombre.trim(),
        correo: formCorreo.trim(),
        rolBackend: adminSeleccionado.rolBackend,
      })
      setModalEditar(false)
      setAvisoExito(`Administrador «${actualizado?.nombre || formNombre.trim()}» actualizado correctamente.`)
      await cargarAdministradores()
    } catch (error) {
      setErrorEditar(mensajeOperacion(error, 'No se pudo actualizar el administrador.'))
    } finally {
      setGuardandoEdicion(false)
      setTimeout(() => setAvisoExito(null), 4000)
    }
  }

  // Activa o desactiva una cuenta (según su estado actual).
  const cambiarEstado = async (adm) => {
    if (!adm || operandoRef.current || estadosEnCurso.has(adm.id)) return
    if (adm.esSuperAdmin && adm.estadoBackend === 'ACTIVO') {
      // El backend protege al último SUPERADMIN activo; se evita la llamada
      // solo si es el único SuperAdmin activo.
      const superActivos = admins.filter(
        (a) => a.esSuperAdmin && a.estadoBackend === 'ACTIVO',
      ).length
      if (superActivos <= 1) {
        setAvisoExito(null)
        setErrorCarga(
          'No se puede desactivar al último SuperAdmin activo.',
        )
        setTimeout(() => setErrorCarga(null), 4000)
        return
      }
    }

    const nuevoEstado = adm.estadoBackend === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    operandoRef.current = true
    setEstadosEnCurso((prev) => new Set(prev).add(adm.id))
    try {
      const actualizado = await cambiarEstadoUsuario(adm.id, nuevoEstado)
      setAdmins((prev) =>
        prev.map((a) => (a.id === adm.id ? { ...a, ...mapearUsuario(actualizado) } : a)),
      )
      setAvisoExito(
        `«${adm.nombre}» ahora está ${actualizado.estado === 'ACTIVO' ? 'activo' : 'inactivo'}.`,
      )
    } catch (error) {
      setAvisoExito(null)
      setErrorCarga(mensajeOperacion(error, 'No se pudo cambiar el estado.'))
    } finally {
      setEstadosEnCurso((prev) => {
        const copia = new Set(prev)
        copia.delete(adm.id)
        return copia
      })
      operandoRef.current = false
      setTimeout(() => {
        setAvisoExito(null)
        setErrorCarga(null)
      }, 4000)
    }
  }

  const abrirEliminar = (adm) => {
    setAdminSeleccionadoId(adm.id)
    setErrorEliminar(null)
    setModalEliminar(true)
  }

  const cerrarEliminar = () => {
    if (eliminando) return
    setModalEliminar(false)
    setErrorEliminar(null)
  }

  const confirmarEliminar = async () => {
    if (!adminSeleccionado || eliminando) return
    setEliminando(true)
    setErrorEliminar(null)
    try {
      await eliminarUsuario(adminSeleccionado.id)
      setModalEliminar(false)
      setAvisoExito(`«${adminSeleccionado.nombre}» fue eliminado.`)
      setAdminSeleccionadoId(null)
      await cargarAdministradores()
    } catch (error) {
      setErrorEliminar(mensajeOperacion(error, 'No se pudo eliminar el administrador.'))
    } finally {
      setEliminando(false)
      setTimeout(() => setAvisoExito(null), 4000)
    }
  }

  return (
    <div className="administradores-vista">
      {/* ===================== Cabecera de Página ===================== */}
      <header className="admin-cabecera">
        <h1 className="admin-cabecera__titulo">Administradores</h1>
        <p className="admin-cabecera__subtitulo">Gestiona los administradores del sistema.</p>
      </header>

      {/* Confirmación de creación */}
      {avisoExito && (
        <div className="admin-aviso admin-aviso--exito" role="status" aria-live="polite">
          <IconoCheck />
          <span>{avisoExito}</span>
        </div>
      )}

      {/* ===================== 4 Tarjetas de Resumen ===================== */}
      <section className="admin-stats" aria-label="Resumen de administradores">
        {/* Card 1: Totales */}
        <article className="admin-stat-card">
          <div className="admin-stat__icono admin-stat__icono--totales">
            <IconoUsuarios />
          </div>
          <div className="admin-stat__cuerpo">
            <span className="admin-stat__valor">{totalAdmins}</span>
            <span className="admin-stat__etiqueta">Administradores totales</span>
            <span className="admin-stat__subnota">Incluye al SuperAdmin</span>
          </div>
        </article>

        {/* Card 2: Activos */}
        <article className="admin-stat-card">
          <div className="admin-stat__icono admin-stat__icono--activos">
            <IconoAdmin />
          </div>
          <div className="admin-stat__cuerpo">
            <span className="admin-stat__valor">{activosAdmins}</span>
            <span className="admin-stat__etiqueta">Administradores activos</span>
            <span className="admin-stat__subnota texto-verde">{porcActivos} % del total</span>
          </div>
        </article>

        {/* Card 3: Inactivos */}
        <article className="admin-stat-card">
          <div className="admin-stat__icono admin-stat__icono--inactivos">
            <IconoUsuarios />
          </div>
          <div className="admin-stat__cuerpo">
            <span className="admin-stat__valor">{inactivosAdmins}</span>
            <span className="admin-stat__etiqueta">Administradores inactivos</span>
            <span className="admin-stat__subnota texto-rojo">{porcInactivos} % del total</span>
          </div>
        </article>

        {/* Card 4: SuperAdmin */}
        <article className="admin-stat-card">
          <div className="admin-stat__icono admin-stat__icono--super">
            <IconoEscudo />
          </div>
          <div className="admin-stat__cuerpo">
            <span className="admin-stat__valor">{superAdminCount}</span>
            <span className="admin-stat__etiqueta">SuperAdmin</span>
            <span className="admin-stat__subnota">Cuenta principal del sistema</span>
          </div>
        </article>
      </section>

      {/* ===================== Barra de Filtros + Botón Nuevo ===================== */}
      <section className="admin-filtros-bar">
        <div className="admin-filtros-grupo">
          <label className="admin-filtro-item">
            <span>Estado</span>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="Todos">Todos</option>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>
          </label>

          <label className="admin-filtro-item">
            <span>Rol</span>
            <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)}>
              <option value="Todos">Todos</option>
              <option value="SuperAdmin">SuperAdmin</option>
              <option value="Administrador">Administrador</option>
            </select>
          </label>

          <label className="admin-filtro-item">
            <span>Fecha de creación</span>
            <select defaultValue="Todas">
              <option value="Todas">📅 Todas</option>
              <option value="UltimoMes">Último mes</option>
            </select>
          </label>

          <label className="admin-filtro-item">
            <span>Ordenar por</span>
            <select value={filtroOrden} onChange={(e) => setFiltroOrden(e.target.value)}>
              <option value="recientes">Más recientes</option>
              <option value="nombre">Nombre (A - Z)</option>
            </select>
          </label>
        </div>

        <button type="button" className="btn-nuevo-admin" onClick={abrirCrear}>
          <IconoPlus />
          <span>Nuevo administrador</span>
        </button>
      </section>

      {/* ===================== Layout Principal (Tabla + Detalle) ===================== */}
      <div className={`admin-layout${drawerAbierto ? ' admin-layout--con-drawer' : ''}`}>
        {/* Tabla Lista de Administradores */}
        <article className="admin-tabla-card">
          <header className="admin-tabla-cabecera">
            <span className="admin-icono-cabecera">
              <IconoUsuarios />
            </span>
            <h2 className="admin-tabla-titulo">Lista de administradores</h2>
          </header>

          {cargando && (
            <div className="admin-tabla-estado" role="status" aria-live="polite">
              <p className="admin-tabla-estado__texto">Cargando administradores…</p>
            </div>
          )}

          {!cargando && errorCarga && (
            <div className="admin-tabla-estado admin-tabla-estado--error" role="alert">
              <span className="admin-tabla-estado__icono" aria-hidden="true">
                <IconoAdvertencia />
              </span>
              <p className="admin-tabla-estado__texto">{errorCarga}</p>
              <button
                type="button"
                className="btn-nuevo-admin"
                onClick={() => cargarAdministradores()}
              >
                Reintentar
              </button>
            </div>
          )}

          {!cargando && !errorCarga && adminsFiltrados.length === 0 && (
            <div className="admin-tabla-estado" role="status">
              <p className="admin-tabla-estado__texto">
                {admins.length === 0
                  ? 'No hay administradores registrados.'
                  : 'Ningún administrador coincide con los filtros aplicados.'}
              </p>
            </div>
          )}

          {!cargando && !errorCarga && adminsFiltrados.length > 0 && (
          <div className="admin-tabla-contenedor">
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th>Correo electrónico</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Fecha de creación</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {adminsPaginados.map((item, index) => {
                  const activa = adminSeleccionado?.id === item.id
                  return (
                    <tr
                      key={item.id}
                      className={activa ? 'fila--activa' : ''}
                      onClick={() => {
                        setAdminSeleccionadoId(item.id)
                        setDrawerAbierto(true)
                      }}
                    >
                      <td>{indiceInicio + index + 1}</td>
                      <td>
                        <div className="admin-celda-nombre">
                          <span className="admin-avatar-mini">{item.avatar}</span>
                          <span className="admin-nombre-texto">{item.nombre}</span>
                          {item.esSuperAdmin && (
                            <span className="admin-badge-corona" title="SuperAdmin">
                              <IconoCorona />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="col-correo">{item.correo}</td>
                      <td>
                        <span className={`admin-rol-badge admin-rol-badge--${item.esSuperAdmin ? 'super' : 'normal'}`}>
                          {item.rol}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-estado-pill admin-estado-pill--${item.estado.toLowerCase()}`}>
                          ● {item.estado}
                        </span>
                      </td>
                      <td>{item.fechaCreacion}</td>
                      <td>
                        <div className="admin-acciones-wrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn-accion-admin"
                            title={item.estadoBackend === 'ACTIVO' ? 'Desactivar cuenta' : 'Activar cuenta'}
                            aria-label={`${item.estadoBackend === 'ACTIVO' ? 'Desactivar' : 'Activar'} ${item.nombre}`}
                            aria-busy={estadosEnCurso.has(item.id)}
                            disabled={estadosEnCurso.has(item.id)}
                            onClick={() => cambiarEstado(item)}
                          >
                            {item.estadoBackend === 'ACTIVO' ? <IconoBloqueo /> : <IconoCheck />}
                          </button>
                          <button
                            type="button"
                            className="btn-accion-admin"
                            title="Editar administrador"
                            aria-label={`Editar ${item.nombre}`}
                            onClick={() => abrirEditar(item)}
                          >
                            <IconoEditar />
                          </button>
                          <button
                            type="button"
                            className="btn-accion-admin btn-accion-admin--eliminar"
                            title={item.esSuperAdmin ? 'No se puede eliminar la cuenta SuperAdmin' : 'Eliminar administrador'}
                            aria-label={`Eliminar ${item.nombre}`}
                            disabled={item.esSuperAdmin}
                            onClick={() => abrirEliminar(item)}
                          >
                            <IconoBasura />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          )}

          {!cargando && !errorCarga && adminsFiltrados.length > 0 && (
          <footer className="admin-paginacion">
            <span className="admin-paginacion__conteo">
              Mostrando {indiceInicio + 1} -{' '}
              {Math.min(indiceInicio + elementosPorPagina, adminsFiltrados.length)} de{' '}
              {adminsFiltrados.length} administradores
            </span>

            <div className="admin-paginacion__controles">
              <button
                type="button"
                className="admin-btn-pag"
                disabled={paginaActual === 1}
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
              >
                &lt;
              </button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => (
                <button
                  type="button"
                  key={num}
                  className={`admin-btn-pag${paginaActual === num ? ' admin-btn-pag--activo' : ''}`}
                  onClick={() => setPaginaActual(num)}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="admin-btn-pag"
                disabled={paginaActual === totalPaginas}
                onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
              >
                &gt;
              </button>
            </div>

            <div className="admin-paginacion__por-pag">
              <span>Mostrar 10 por página</span>
            </div>
          </footer>
          )}
        </article>

        {/* Panel lateral: Detalle del Administrador */}
        {drawerAbierto && adminSeleccionado && (
          <aside className="admin-detalle-panel" aria-label="Detalle del administrador">
            <header className="admin-detalle__header">
              <div className="admin-detalle__header-izq">
                <IconoAdmin className="admin-detalle__header-icono" />
                <h3 className="admin-detalle__titulo">Detalle del administrador</h3>
              </div>
              <button
                type="button"
                className="admin-detalle__btn-cerrar"
                onClick={() => setDrawerAbierto(false)}
                aria-label="Cerrar panel de detalle"
              >
                <IconoCruz />
              </button>
            </header>

            <div className="admin-detalle__hero">
              <div className="admin-detalle__avatar-grande">{adminSeleccionado.avatar}</div>
              <div className="admin-detalle__hero-textos">
                <div className="admin-detalle__hero-fila">
                  <h4 className="admin-detalle__hero-nombre">{adminSeleccionado.nombre}</h4>
                  <span className={`admin-estado-pill admin-estado-pill--${adminSeleccionado.estado.toLowerCase()}`}>
                    ● {adminSeleccionado.estado}
                  </span>
                </div>
                <div className="admin-detalle__rol-wrap">
                  {adminSeleccionado.esSuperAdmin && <IconoCorona />}
                  <span>{adminSeleccionado.rol}</span>
                </div>
              </div>
            </div>

            <div className="admin-detalle__metas">
              <div className="admin-meta-fila">
                <span className="admin-meta-label">
                  <IconoSobre /> Correo electrónico
                </span>
                <span className="admin-meta-valor">{adminSeleccionado.correo}</span>
              </div>
              <div className="admin-meta-fila">
                <span className="admin-meta-label">
                  <IconoAdmin /> Rol
                </span>
                <span className="admin-meta-valor">{adminSeleccionado.rol}</span>
              </div>
              <div className="admin-meta-fila">
                <span className="admin-meta-label">
                  <IconoCalendario /> Fecha de creación
                </span>
                <span className="admin-meta-valor">{adminSeleccionado.fechaCreacion}</span>
              </div>
              <div className="admin-meta-fila">
                <span className="admin-meta-label">
                  <IconoReloj /> Última actualización
                </span>
                <span className="admin-meta-valor">{adminSeleccionado.ultimaActualizacion}</span>
              </div>
            </div>

            <div className="admin-detalle__footer">
              <button
                type="button"
                className="btn-editar-admin-panel"
                onClick={() => abrirEditar(adminSeleccionado)}
              >
                <IconoEditar />
                <span>Editar administrador</span>
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* ===================== Modal: Crear Administrador ===================== */}
      {modalCrear && (
        <div className="admin-modal-overlay" onClick={cerrarCrear}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <header className="admin-modal__header">
              <h3 className="admin-modal__titulo">Nuevo administrador</h3>
              <button
                type="button"
                className="admin-modal__cerrar"
                onClick={cerrarCrear}
                disabled={creando}
              >
                <IconoCruz />
              </button>
            </header>

            <form onSubmit={guardarNuevo} className="admin-modal__form">
              <div className="admin-campo">
                <label>Nombre completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Laura Méndez"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  disabled={creando}
                />
              </div>

              <div className="admin-campo">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="laura.mendez@museo.com"
                  value={formCorreo}
                  onChange={(e) => setFormCorreo(e.target.value)}
                  disabled={creando}
                />
              </div>

              <div className="admin-campo">
                <label>Contraseña inicial</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={formContrasena}
                  onChange={(e) => setFormContrasena(e.target.value)}
                  disabled={creando}
                />
                <span className="admin-campo__ayuda">
                  La cuenta se crea como Administrador activo y deberá cambiar la contraseña
                  en su primer inicio de sesión.
                </span>
              </div>

              {errorCrear && (
                <div className="admin-modal__error" role="alert">
                  <IconoAdvertencia />
                  <span>{errorCrear}</span>
                </div>
              )}

              <footer className="admin-modal__footer">
                <button
                  type="button"
                  className="btn-modal-cancelar"
                  onClick={cerrarCrear}
                  disabled={creando}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-modal-guardar" disabled={creando}>
                  {creando ? 'Guardando…' : 'Guardar administrador'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ===================== Modal: Editar Administrador ===================== */}
      {modalEditar && (
        <div className="admin-modal-overlay" onClick={cerrarEditar}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <header className="admin-modal__header">
              <h3 className="admin-modal__titulo">Editar administrador</h3>
              <button
                type="button"
                className="admin-modal__cerrar"
                onClick={cerrarEditar}
                disabled={guardandoEdicion}
              >
                <IconoCruz />
              </button>
            </header>

            <form onSubmit={guardarEdicion} className="admin-modal__form">
              <div className="admin-campo">
                <label>Nombre completo</label>
                <input
                  type="text"
                  required
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  disabled={guardandoEdicion}
                />
              </div>

              <div className="admin-campo">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  required
                  value={formCorreo}
                  onChange={(e) => setFormCorreo(e.target.value)}
                  disabled={guardandoEdicion}
                />
              </div>

              <div className="admin-campos-fila">
                <div className="admin-campo">
                  <label>Rol</label>
                  <select value={formRol} disabled title="El rol de una cuenta no se modifica">
                    <option value="Administrador">Administrador</option>
                    <option value="SuperAdmin">SuperAdmin</option>
                  </select>
                </div>
              </div>

              {errorEditar && (
                <div className="admin-modal__error" role="alert">
                  <IconoAdvertencia />
                  <span>{errorEditar}</span>
                </div>
              )}

              <footer className="admin-modal__footer">
                <button
                  type="button"
                  className="btn-modal-cancelar"
                  onClick={cerrarEditar}
                  disabled={guardandoEdicion}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-modal-guardar" disabled={guardandoEdicion}>
                  {guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ===================== Modal: Confirmar Eliminar ===================== */}
      {modalEliminar && adminSeleccionado && (
        <div className="admin-modal-overlay" onClick={cerrarEliminar}>
          <div className="admin-modal admin-modal--eliminar" onClick={(e) => e.stopPropagation()}>
            <header className="admin-modal__header">
              <h3 className="admin-modal__titulo">Eliminar administrador</h3>
              <button
                type="button"
                className="admin-modal__cerrar"
                onClick={cerrarEliminar}
                disabled={eliminando}
              >
                <IconoCruz />
              </button>
            </header>

            <div className="admin-modal__cuerpo-alerta">
              <p>
                ¿Estás seguro de que deseas eliminar al administrador{' '}
                <strong>{adminSeleccionado.nombre}</strong>?
              </p>
              <p className="admin-modal__nota-alerta">
                Esta acción no se puede deshacer. Se revocarán todos sus permisos de acceso.
              </p>
            </div>

            {errorEliminar && (
              <div className="admin-modal__error" role="alert">
                <IconoAdvertencia />
                <span>{errorEliminar}</span>
              </div>
            )}

            <footer className="admin-modal__footer">
              <button
                type="button"
                className="btn-modal-cancelar"
                onClick={cerrarEliminar}
                disabled={eliminando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-modal-eliminar"
                onClick={confirmarEliminar}
                disabled={eliminando}
              >
                {eliminando ? 'Eliminando…' : 'Eliminar administrador'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
