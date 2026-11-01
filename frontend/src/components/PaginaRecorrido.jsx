import Navbar from './Navbar'
import Footer from './Footer'
import RecorridoMuseo from './RecorridoMuseo'
import './PaginaRecorrido.css'

// Vista independiente (#/recorrido-virtual). Reutiliza la cabecera y el pie del
// sitio para conservar el diseño y la navegación, y no monta nada del resto de
// la página de inicio (no se duplica el visor).
export default function PaginaRecorrido({ onVolver, onIngresar }) {
  return (
    <div className="app">
      <Navbar onIngresar={onIngresar} />

      <main className="app__principal">
        <div className="pagina-recorrido">
          <button
            type="button"
            className="pagina-recorrido__volver"
            onClick={onVolver}
          >
            ← Volver a las salas
          </button>

          <header className="pagina-recorrido__cabecera">
            <h1 className="pagina-recorrido__titulo">Recorrido virtual</h1>
            <p className="pagina-recorrido__texto">
              Recorre el museo en primera persona, observa cada pieza y
              selecciónala para conocer su ficha.
            </p>
          </header>

          <RecorridoMuseo />
        </div>
      </main>

      <Footer />
    </div>
  )
}
