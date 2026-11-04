import { RUTAS } from '../data/rutas'

export default function Footer({ sesion }) {
  const autenticado = Boolean(sesion)

  return (
    <footer className="pie">
      <div className="pie__contenido">
        <p className="pie__creditos">
          © {new Date().getFullYear()} Museo Smart — Explora · Aprende · Descubre
        </p>
        <a
          className="pie__acceso"
          href={autenticado ? RUTAS.admin : RUTAS.login}
        >
          {autenticado ? 'Ir al panel' : 'Acceso del personal'}
        </a>
      </div>
    </footer>
  )
}
