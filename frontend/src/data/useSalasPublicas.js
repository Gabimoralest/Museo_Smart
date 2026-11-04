// Hook de carga de las salas públicas de la portada.
//
// Encapsula el estado de la petición a GET /api/v1/salas para que las secciones
// de la página de inicio (Hero y Salas) compartan una sola carga, el mismo error
// y el mismo reintento. No usa datos fijos: si la API falla, expone el error y
// una función `reintentar`.

import { useCallback, useEffect, useState } from 'react'
import { listarSalasPublicas } from './exhibicionesPublicasApi'
import { ordenarSalas } from './salasPublicas'

export function useSalasPublicas() {
  const [salas, setSalas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  // Cambiarlo fuerza una nueva petición (botón "Reintentar").
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    const controlador = new AbortController()

    listarSalasPublicas({ signal: controlador.signal })
      .then((datos) => {
        if (controlador.signal.aborted) return
        setSalas(ordenarSalas(Array.isArray(datos) ? datos : []))
        setError(false)
        setCargando(false)
      })
      .catch((fallo) => {
        if (fallo?.name === 'AbortError') return
        setSalas([])
        setError(true)
        setCargando(false)
      })

    return () => controlador.abort()
  }, [intento])

  const reintentar = useCallback(() => {
    setError(false)
    setCargando(true)
    setIntento((n) => n + 1)
  }, [])

  return { salas, cargando, error, reintentar }
}
