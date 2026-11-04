import { RUTAS } from '../data/rutas'

// Página para rutas desconocidas. Mantiene cabecera y pie (los aporta App) y
// ofrece volver al inicio.
export default function NoEncontrada() {
  return (
    <section className="pagina-no-encontrada">
      <p className="pagina-no-encontrada__codigo">404</p>
      <h1 className="pagina-no-encontrada__titulo">Página no encontrada</h1>
      <p className="pagina-no-encontrada__texto">
        La dirección que buscas no existe o ha cambiado de lugar.
      </p>
      <a className="boton-explorar" href={RUTAS.inicio}>
        Volver al inicio
      </a>
    </section>
  )
}
