import TarjetaSala from './TarjetaSala'
import { salas } from '../data/salas'

export default function Salas({ onSeleccionarSala }) {
  return (
    <section className="seccion-salas" id="salas">
      <div className="seccion-salas__cabecera">
        <h2 className="seccion-salas__titulo">Nuestras salas</h2>
        <p className="seccion-salas__subtitulo">
          Descubre cuatro mundos llenos de historia, cultura y naturaleza.
        </p>
      </div>

      <div className="seccion-salas__grid">
        {salas.map((sala) => (
          <TarjetaSala
            key={sala.id}
            sala={sala}
            onSeleccionar={onSeleccionarSala}
          />
        ))}
      </div>
    </section>
  )
}
