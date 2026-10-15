import { useState } from 'react'

const enlaces = [
  { etiqueta: 'Inicio', destino: '#inicio', activo: true },
  { etiqueta: 'Salas', destino: '#salas' },
  { etiqueta: 'Acerca de', destino: '#acerca' },
  { etiqueta: 'Vive la experiencia', destino: '#experiencia' },
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

function IconoUsuario() {
  return (
    <svg
      className="cabecera__acceso-icono"
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
    >
      <path
        d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.4-8 5.4V21h16v-1.6c0-3-3.6-5.4-8-5.4Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function Navbar({ onIngresar }) {
  const [menuAbierto, setMenuAbierto] = useState(false)

  const alternarMenu = () => setMenuAbierto((abierto) => !abierto)
  const cerrarMenu = () => setMenuAbierto(false)

  return (
    <header className="cabecera">
      <a className="marca" href="#inicio" onClick={cerrarMenu}>
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
        className="cabecera__hamburguesa"
        aria-label="Abrir menú de navegación"
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
                className={`nav__enlace${enlace.activo ? ' nav__enlace--activo' : ''}`}
                href={enlace.destino}
                onClick={cerrarMenu}
              >
                {enlace.etiqueta}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <button
        type="button"
        className="cabecera__acceso"
        onClick={onIngresar}
        aria-label="Acceso administrador"
      >
        <IconoUsuario />
        <span>Acceso</span>
      </button>
    </header>
  )
}
