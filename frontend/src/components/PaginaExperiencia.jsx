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
      <path d="m16.2 7.8-2.4 6-6 2.4 2.4-6 6-2.4Z" fill="currentColor" />
    </svg>
  )
}

// Página "Vive la experiencia": conserva el contenido que antes vivía en la
// portada (lema y acceso al recorrido) y lo presenta como página propia.
export default function Experiencia() {
  return (
    <section className="pagina-experiencia" id="experiencia">
      <div className="pagina-experiencia__portada">
        <img className="pagina-experiencia__imagen" src={HERO_IMAGEN} alt="" />
        <div className="pagina-experiencia__capa">
          <span className="pagina-experiencia__etiqueta">Vive la experiencia</span>
          <h1 className="pagina-experiencia__titulo">UN VIAJE AL CONOCIMIENTO</h1>
          <p className="pagina-experiencia__texto">
            Recorre el museo en primera persona, observa cada pieza y selecciónala
            para conocer su ficha. Una visita inmersiva, accesible y gratuita desde
            cualquier lugar.
          </p>
          <a className="boton-explorar" href={RUTAS.recorrido}>
            <IconoBrujula />
            Entrar al recorrido 3D
          </a>
        </div>
      </div>

      <div className="pagina-experiencia__detalle">
        <article className="pagina-experiencia__bloque">
          <h2 className="pagina-experiencia__bloque-titulo">Recorrido en primera persona</h2>
          <p className="pagina-experiencia__bloque-texto">
            Camina por las salas, mira a tu alrededor y detente frente a cada obra.
            Puedes moverte con el teclado o arrastrando el ratón y, en el móvil, con
            el joystick en pantalla.
          </p>
        </article>
        <article className="pagina-experiencia__bloque">
          <h2 className="pagina-experiencia__bloque-titulo">Fichas de cada exhibición</h2>
          <p className="pagina-experiencia__bloque-texto">
            Al acercarte a una pieza verás su ficha con imágenes, descripción y datos
            de interés. La información se actualiza desde el catálogo del museo.
          </p>
        </article>
        <article className="pagina-experiencia__bloque">
          <h2 className="pagina-experiencia__bloque-titulo">Visita guiada</h2>
          <p className="pagina-experiencia__bloque-texto">
            Salta a cualquier sala o sigue el recorrido guiado obra a obra, con
            transiciones suaves entre espacios.
          </p>
        </article>
      </div>
    </section>
  )
}
