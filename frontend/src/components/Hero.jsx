import { HERO_IMAGEN } from '../data/salasPublicas'
import { RUTAS } from '../data/rutas'

function IconoBrujula() {
  return (
    <svg
      className="boton-explorar__icono"
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
    >
      <path
        d="m16.2 7.8-2.4 6-6 2.4 2.4-6 6-2.4Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function Hero() {
  return (
    <section className="hero" id="inicio">
      <img className="hero__imagen" src={HERO_IMAGEN} alt="" />

      <div className="hero__capa">
        <div className="hero__centro">
          <h1 className="hero__titulo">MUSEO SMART</h1>
          <p className="hero__lema">UN VIAJE AL CONOCIMIENTO</p>
          <a className="boton-explorar" href={RUTAS.salas}>
            <IconoBrujula />
            Explora las salas
          </a>
        </div>
      </div>
    </section>
  )
}
