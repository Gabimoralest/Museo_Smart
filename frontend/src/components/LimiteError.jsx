// ============================================================
// Límite de error — Museo Smart
// ------------------------------------------------------------
// Evita que un fallo al renderizar una sección (por ejemplo, la gráfica
// histórica de ECharts o su carga diferida) derribe toda la página. Muestra
// un aviso con "Reintentar" y vuelve a montar solo ese subárbol.
// ============================================================
import { Component, Fragment } from 'react'

export default class LimiteError extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, intento: 0 }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Error al renderizar una sección del panel:', error, info)
  }

  reintentar = () => {
    this.setState((prev) => ({ error: null, intento: prev.intento + 1 }))
  }

  render() {
    if (this.state.error) {
      const mensaje = this.props.mensaje || 'No se pudo mostrar esta sección.'
      return (
        <article className="monitoreo-grafica-card monitoreo-grafica-card--ancho">
          <div className="monitoreo-vacio" role="alert">
            <span>{mensaje}</span>
            <button
              type="button"
              className="monitoreo-aviso__boton"
              onClick={this.reintentar}
            >
              Reintentar
            </button>
          </div>
        </article>
      )
    }
    return <Fragment key={this.state.intento}>{this.props.children}</Fragment>
  }
}
