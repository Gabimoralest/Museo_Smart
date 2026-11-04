import { useEffect, useState } from 'react'

import { RUTAS } from '../data/rutas'

const enlaces = [
  { etiqueta: 'Inicio', destino: RUTAS.inicio, pagina: 'inicio' },
  { etiqueta: 'Salas', destino: RUTAS.salas, pagina: 'salas' },
  { etiqueta: 'Acerca de', destino: RUTAS.acerca, pagina: 'acerca' },
  { etiqueta: 'Vive la experiencia', destino: RUTAS.experiencia, pagina: 'experiencia' },
]

function IconoMuseo() {
  return (
    <svg
      className="marca__icono"
      viewBox="0 0 48 48"
      role="presentation"
      aria-hidden="true"
    >
      <path
        d="M24 4 6 14v3h36v-3L24 4Zm-14 16v14h5V20h-5Zm9 0v14h5V20h-5Zm9 0v14h5V20h-5Zm9 0v14h5V20h-5ZM6 37v3h36v-3H6Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function Navbar({ paginaActual = 'inicio' }) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [paginaAnterior, setPaginaAnterior] = useState(paginaActual)

  if (paginaAnterior !== paginaActual) {
    setPaginaAnterior(paginaActual)
    setMenuAbierto(false)
  }

  const alternarMenu = () => setMenuAbierto((abierto) => !abierto)
  const cerrarMenu = () => setMenuAbierto(false)

  useEffect(() => {
    if (!menuAbierto) return undefined
    const alPulsarTecla = (e) => {
      if (e.key === 'Escape') setMenuAbierto(false)
    }
    document.addEventListener('keydown', alPulsarTecla)
    return () => document.removeEventListener('keydown', alPulsarTecla)
  }, [menuAbierto])

  return (
    <header className="cabecera">
      <div className="cabecera__interior">
        <a className="marca" href={RUTAS.inicio} onClick={cerrarMenu}>
          <IconoMuseo />
          <span className="marca__texto">
            <span className="marca__titulo">
              MUSEO <strong>SMART</strong>
            </span>
            <span className="marca__lema">EXPLORA · APRENDE · DESCUBRE</span>
          </span>
        </a>

        <button
          type="button"
          className={`cabecera__hamburguesa${menuAbierto ? ' cabecera__hamburguesa--abierta' : ''}`}
          aria-label={menuAbierto ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
          aria-expanded={menuAbierto}
          onClick={alternarMenu}
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          className={`nav${menuAbierto ? ' nav--abierto' : ''}`}
          aria-label="Navegación principal"
        >
          <ul className="nav__lista">
            {enlaces.map((enlace) => (
              <li key={enlace.etiqueta}>
                <a
                  className={`nav__enlace${paginaActual === enlace.pagina ? ' nav__enlace--activo' : ''}`}
                  href={enlace.destino}
                  aria-current={paginaActual === enlace.pagina ? 'page' : undefined}
                  onClick={cerrarMenu}
                >
                  {enlace.etiqueta}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
