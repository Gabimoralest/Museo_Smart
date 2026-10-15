import { heroImagen, salas } from '../data/salas'

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

export default function Hero({ onSeleccionarSala }) {
  return (
    <section className="hero" id="inicio">
      <img className="hero__imagen" src={heroImagen} alt="" />

      <div className="hero__capa">
        <ul className="hero__salas" aria-label="Salas del museo">
          {salas.map((sala) => (
            <li key={sala.id}>
              <button
                type="button"
                className="hero__sala"
                onClick={() => onSeleccionarSala(sala)}
              >
                <span className="hero__sala-nombre">{sala.etiquetaSala}</span>
                <span className="hero__sala-titulo">{sala.etiquetaTitulo}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="hero__centro" id="experiencia">
          <h1 className="hero__titulo">MUSEO SMART</h1>
          <p className="hero__lema">UN VIAJE AL CONOCIMIENTO</p>
          <a className="boton-explorar" href="#/recorrido-virtual">
            <IconoBrujula />
            Explora las salas
          </a>
        </div>
      </div>
    </section>
  )
}
