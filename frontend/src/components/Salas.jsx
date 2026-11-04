import TarjetaSala from './TarjetaSala'

// Estado de error compartido por las secciones de la portada. Muestra un
// mensaje claro y un botón para volver a intentar la carga de la API.
function AvisoErrorSalas({ onReintentar }) {
  return (
    <div className="seccion-salas__error" role="alert">
      <p className="seccion-salas__error-texto">
        No pudimos cargar las salas del museo. Revisa tu conexión e inténtalo de nuevo.
      </p>
      {onReintentar && (
        <button type="button" className="modal__accion" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  )
}

export default function Salas({ salas = [], cargando = false, error = false, onReintentar, onSeleccionarSala }) {
  return (
    <section className="seccion-salas" id="salas">
      <div className="seccion-salas__cabecera">
        <h2 className="seccion-salas__titulo">Nuestras salas</h2>
        <p className="seccion-salas__subtitulo">
          Descubre los espacios del museo: historia, cultura y naturaleza en un
          mismo recorrido.
        </p>
      </div>

      {error && !cargando && <AvisoErrorSalas onReintentar={onReintentar} />}

      {!error && cargando && (
        <p className="seccion-salas__estado" role="status">
          Cargando salas…
        </p>
      )}

      {!error && !cargando && salas.length === 0 && (
        <p className="seccion-salas__estado" role="status">
          No hay salas disponibles por el momento.
        </p>
      )}

      {!error && !cargando && salas.length > 0 && (
        <div className="seccion-salas__grid">
          {salas.map((sala) => (
            <TarjetaSala
              key={sala.id}
              sala={sala}
              onSeleccionar={onSeleccionarSala}
            />
          ))}
        </div>
      )}
    </section>
  )
}
