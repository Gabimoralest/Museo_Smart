import Salas from './Salas'

// Página de Salas: reutiliza el componente existente (carga desde la API y abre
// ModalSala al elegir una sala).
export default function PaginaSalas({ salas, cargando, error, onReintentar, onSeleccionarSala }) {
  return (
    <Salas
      salas={salas}
      cargando={cargando}
      error={error}
      onReintentar={onReintentar}
      onSeleccionarSala={onSeleccionarSala}
    />
  )
}
