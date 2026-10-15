import { useEffect, useState } from 'react'
import {
  IconoTemplo,
  IconoColeccion,
  IconoAdmin,
  IconoAlerta,
  IconoAnalitica,
  IconoBuscar,
  IconoChevron,
  IconoSalir,
  IconoMenu,
  IconoCasa,
  IconoAntena,
  IconoCorona,
  IconoCampana,
  IconoChevronIzquierda,
} from './iconos'
import { secciones, imagenesPanel } from '../data/panelSuperAdmin'

// Subvistas administrativas
import InicioDashboard from './InicioDashboard'
import GestionExhibiciones from './GestionExhibiciones'
import MonitoreoIoT from './MonitoreoIoT'
import Alertas from './Alertas'
import Popularidad from './Popularidad'
import Administradores from './Administradores'
import MiPerfil from './MiPerfil'

import './PanelAdmin.css'

// Catálogo de iconos para la navegación lateral (sin multimedia)
const ICONOS = {
  inicio: IconoCasa,
  coleccion: IconoColeccion,
  sensor: IconoAntena,
  alerta: IconoAlerta,
  analitica: IconoAnalitica,
  admin: IconoAdmin,
  perfil: IconoAdmin,
}

const IconoDe = ({ nombre, className }) => {
  const Componente = ICONOS[nombre] || IconoColeccion
  return <Componente className={className} />
}

const CLAVE_MENU = 'museo_smart.panel.menu-contratido'

const navegar = (ruta) => {
  window.location.hash = ruta
}

const leerSeccionDeHash = () => {
  const hash = window.location.hash
  if (hash === '#/admin' || hash === '#/admin/inicio') return 'inicio'
  if (hash === '#/admin/exhibiciones' || hash === '#gestion-exhibiciones') return 'exhibiciones'
  if (hash === '#/admin/monitoreo') return 'monitoreo'
  if (hash === '#/admin/alertas') return 'alertas'
  if (hash === '#/admin/popularidad') return 'popularidad'
  if (hash === '#/admin/administradores') return 'administradores'
  if (hash === '#/admin/perfil') return 'perfil'
  return 'inicio'
}

export default function PanelAdmin({ sesion, onCerrarSesion, onVolverAlMuseo }) {
  // El backend devuelve el rol (POST /api/v1/auth/login) como 'SUPERADMIN' o
  // 'ADMIN' y sessionService lo guarda tal cual. Se normaliza a mayúsculas por
  // si llegara en otra capitalización. Esta comprobación es solo visual: la
  // autorización real siempre la impone Spring Security en cada endpoint.
  const esSuperAdmin = (sesion?.rol || '').toUpperCase() === 'SUPERADMIN'

  // Inicial para el avatar circular: primera letra del nombre real; si no hay
  // nombre, la del correo. Nunca una letra fija.
  const nombrePerfil = sesion?.nombre || sesion?.correo || ''
  const inicialPerfil = nombrePerfil.trim().charAt(0).toUpperCase() || '?'

  const [seccionActual, setSeccionActual] = useState(leerSeccionDeHash)
  const [busquedaTopbar, setBusquedaTopbar] = useState('')

  const [contratido, setContratido] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_MENU) === 'true'
    } catch {
      return false
    }
  })
  const [menuMovil, setMenuMovil] = useState(false)
  const [menuPerfil, setMenuPerfil] = useState(false)

  // Sincronizar sección con cambios de hash en el navegador
  useEffect(() => {
    const alCambiarHash = () => {
      setSeccionActual(leerSeccionDeHash())
    }
    window.addEventListener('hashchange', alCambiarHash)
    return () => window.removeEventListener('hashchange', alCambiarHash)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_MENU, String(contratido))
    } catch {
      // Sin acceso a localStorage
    }
  }, [contratido])

  const alternarMenu = () => setContratido((valor) => !valor)
  const alternarMovil = () => setMenuMovil((valor) => !valor)
  const cerrarMovil = () => setMenuMovil(false)

  const irA = (seccion) => {
    cerrarMovil()
    if (seccion?.ruta) {
      navegar(seccion.ruta)
      setSeccionActual(seccion.id)
    } else if (seccion?.id) {
      setSeccionActual(seccion.id)
    }
  }

  const seccionesVisibles = secciones.filter(
    (seccion) => esSuperAdmin || !seccion.soloSuperAdmin,
  )

  return (
    <div
      className={`panel${contratido ? ' panel--contratido' : ''}${
        menuMovil ? ' panel--movil-abierto' : ''
      }`}
    >
      {/* ===================== Menú lateral compartido con estatua ===================== */}
      <aside className="panel__lateral" aria-label="Navegación del panel">
        <div className="lateral__superior">
          <div className="lateral__marca">
            <IconoTemplo className="lateral__marca-icono" />
            <div className="lateral__marca-textos">
              <span className="lateral__marca-titulo">MUSEO SMART</span>
              <span className="lateral__marca-lema">EXPLORA • APRENDE • DESCUBRE</span>
            </div>
          </div>

          <button
            type="button"
            className="lateral__contraer"
            onClick={alternarMenu}
            aria-label={contratido ? 'Expandir menú' : 'Contraer menú'}
            aria-expanded={!contratido}
          >
            <IconoChevronIzquierda className={contratido ? 'lateral__chevron-invertido' : ''} />
          </button>
        </div>

        <nav className="lateral__nav" aria-label="Secciones del panel">
          <ul className="lateral__lista">
            {seccionesVisibles.map((seccion) => {
              const activa = seccion.id === seccionActual
              return (
                <li key={seccion.id}>
                  <button
                    type="button"
                    className={`lateral__enlace${activa ? ' lateral__enlace--activo' : ''}`}
                    onClick={() => irA(seccion)}
                    aria-current={activa ? 'page' : undefined}
                    data-tooltip={seccion.etiqueta}
                    title={contratido ? seccion.etiqueta : undefined}
                  >
                    <span className="lateral__enlace-icono" aria-hidden="true">
                      <IconoDe nombre={seccion.icono} />
                    </span>
                    <span className="lateral__enlace-texto">{seccion.etiqueta}</span>
                    {seccion.corona && (
                      <span className="lateral__corona" aria-hidden="true" title="Exclusivo SuperAdmin">
                        <IconoCorona />
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Imagen arquitectónica del museo al pie del menú lateral compartido */}
        <div className="lateral__decoracion">
          <img
            className="lateral__decoracion-imagen"
            src={imagenesPanel.lateral}
            alt="Museo del Patrimonio Colombiano"
          />
          <div className="lateral__decoracion-capa" aria-hidden="true" />
          <div className="lateral__decoracion-texto">
            <span className="lateral__decoracion-museo">Museo del</span>
            <span className="lateral__decoracion-nombre">Patrimonio Colombiano</span>
            <span className="lateral__decoracion-credito">© 2026 Museo_Smart</span>
          </div>
        </div>
      </aside>

      <div
        className="panel__velo"
        role="presentation"
        onClick={cerrarMovil}
        aria-hidden="true"
      />

      {/* ===================== Cuerpo ===================== */}
      <div className="panel__cuerpo">
        {/* Barra superior */}
        <header className="topbar">
          <button
            type="button"
            className="topbar__menu-movil"
            onClick={alternarMovil}
            aria-label="Abrir menú"
            aria-expanded={menuMovil}
          >
            <IconoMenu />
          </button>

          <label className="topbar__buscador">
            <span className="topbar__buscador-icono" aria-hidden="true">
              <IconoBuscar />
            </span>
            <input
              type="search"
              className="topbar__buscador-input"
              placeholder="Buscar una exhibición…"
              aria-label="Buscar una exhibición"
              value={busquedaTopbar}
              onChange={(e) => setBusquedaTopbar(e.target.value)}
            />
          </label>

          <div className="topbar__acciones">
            <button
              type="button"
              className="topbar__notificaciones"
              aria-label="Notificaciones (3 sin leer)"
              onClick={() => {
                navegar('#/admin/alertas')
                setSeccionActual('alertas')
              }}
            >
              <IconoCampana />
              <span className="topbar__badge" aria-hidden="true">
                3
              </span>
            </button>

            <div className="topbar__perfil">
              <button
                type="button"
                className="perfil__disparador"
                onClick={() => setMenuPerfil((valor) => !valor)}
                aria-haspopup="menu"
                aria-expanded={menuPerfil}
              >
                <span className="perfil__avatar" aria-hidden="true">
                  {inicialPerfil}
                </span>
                <span className="perfil__datos">
                  <span className="perfil__nombre">{sesion?.nombre || sesion?.correo || '—'}</span>
                  <span className="perfil__rol">{sesion?.rol || '—'}</span>
                </span>
                <IconoChevron className="perfil__chevron" />
              </button>

              {menuPerfil && (
                <div className="perfil__menu" role="menu">
                  <p className="perfil__menu-correo">
                    {sesion?.correo || '—'}
                  </p>
                  <button
                    type="button"
                    className="perfil__menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuPerfil(false)
                      navegar('#/admin/perfil')
                      setSeccionActual('perfil')
                    }}
                  >
                    <IconoAdmin />
                    Mi perfil
                  </button>
                  <button
                    type="button"
                    className="perfil__menu-item"
                    role="menuitem"
                    onClick={onVolverAlMuseo}
                  >
                    <IconoCasa />
                    Volver al museo virtual
                  </button>
                  <button
                    type="button"
                    className="perfil__menu-item perfil__menu-item--salir"
                    role="menuitem"
                    onClick={onCerrarSesion}
                  >
                    <IconoSalir />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ===================== Contenido principal dinámico ===================== */}
        <main className="panel__principal">
          {seccionActual === 'inicio' && (
            <InicioDashboard
              sesion={sesion}
              onNavegar={(ruta) => {
                navegar(ruta)
                setSeccionActual(leerSeccionDeHash())
              }}
            />
          )}

          {seccionActual === 'exhibiciones' && (
            <GestionExhibiciones
              busqueda={busquedaTopbar}
              onCambiarBusqueda={setBusquedaTopbar}
            />
          )}

          {seccionActual === 'monitoreo' && <MonitoreoIoT />}

          {seccionActual === 'alertas' && <Alertas />}

          {seccionActual === 'popularidad' && <Popularidad />}

          {seccionActual === 'administradores' && <Administradores sesion={sesion} />}

          {seccionActual === 'perfil' && <MiPerfil sesion={sesion} />}
        </main>
      </div>
    </div>
  )
}
