import { lazy, Suspense, useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ModalSala from './components/ModalSala'
import Login from './components/Login'
import Recuperacion from './components/Recuperacion'
import PanelAdmin from './components/PanelAdmin'
import { obtenerSesion, limpiarSesion } from './data/sessionService'
import { useSalasPublicas } from './data/useSalasPublicas'
import { RUTAS, esPaginaPublica, leerRuta, tituloDe } from './data/rutas'
import './App.css'

// El visor 3D (three.js + modelo de ~64 MB) se carga solo al entrar en la ruta
// del recorrido, para no penalizar el resto del sitio.
const PaginaRecorrido = lazy(() => import('./components/PaginaRecorrido'))
// Páginas públicas diferidas: el inicio no arrastra el código de Salas,
// Acerca de ni Experiencia.
const PaginaInicio = lazy(() => import('./components/PaginaInicio'))
const PaginaSalas = lazy(() => import('./components/PaginaSalas'))
const PaginaAcerca = lazy(() => import('./components/PaginaAcerca'))
const PaginaExperiencia = lazy(() => import('./components/PaginaExperiencia'))
const PaginaNoEncontrada = lazy(() => import('./components/PaginaNoEncontrada'))

function CargandoPagina() {
  return (
    <div className="app__cargando" role="status">
      Cargando…
    </div>
  )
}

export default function App() {
  const [salaActiva, setSalaActiva] = useState(null)
  const [ruta, setRuta] = useState(leerRuta)
  const [correoRecuperacion, setCorreoRecuperacion] = useState('')
  const [sesion, setSesion] = useState(obtenerSesion)
  // Salas: una única carga desde GET /api/v1/salas, compartida por las páginas
  // que las necesitan (incluidos el error y el reintento).
  const { salas, cargando: cargandoSalas, error: errorSalas, reintentar } = useSalasPublicas()

  // Navegación por hash. Al cambiar de página se sube al inicio y se actualiza
  // el título de la pestaña. El botón Atrás/Adelante del navegador funciona
  // porque siempre se escucha `hashchange`.
  useEffect(() => {
    const alCambiarRuta = () => {
      setRuta(leerRuta())
      // Al cambiar de página se cierra cualquier modal de sala abierto.
      setSalaActiva(null)
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', alCambiarRuta)
    return () => window.removeEventListener('hashchange', alCambiarRuta)
  }, [])

  useEffect(() => {
    document.title = tituloDe(ruta)
  }, [ruta])

  const abrirSala = (sala) => setSalaActiva(sala)
  const cerrarSala = () => setSalaActiva(null)

  const irA = (destino) => {
    window.location.hash = destino
  }

  const volverAlInicio = () => {
    window.location.hash = RUTAS.inicio
    window.scrollTo({ top: 0 })
  }

  const cerrarSesion = () => {
    limpiarSesion()
    setSesion(null)
    irA(RUTAS.login)
  }

  // Tras un login correcto se dirige a la ruta de administración; la
  // autorización real la impone el backend en cada endpoint.
  const alIniciarSesion = (nuevaSesion) => {
    setSesion(nuevaSesion)
    irA(RUTAS.admin)
  }

  if (ruta === 'login') {
    return (
      <Login
        onVolver={volverAlInicio}
        onSesionIniciada={alIniciarSesion}
        onRecuperar={(correo) => {
          setCorreoRecuperacion(correo || '')
          irA(RUTAS.recuperacion)
        }}
      />
    )
  }

  if (ruta === 'recuperacion') {
    return (
      <Recuperacion
        correoInicial={correoRecuperacion}
        onVolverAlLogin={() => irA(RUTAS.login)}
        onVolverAlMuseo={volverAlInicio}
      />
    )
  }

  if (ruta === 'recorrido') {
    return (
      <Suspense
        fallback={
          <div className="app">
            <Navbar paginaActual={ruta} />
            <main className="app__principal">
              <CargandoPagina />
            </main>
          </div>
        }
      >
        <PaginaRecorrido onVolver={volverAlInicio} sesion={sesion} />
      </Suspense>
    )
  }

  if (ruta === 'admin') {
    // Ruta protegida del lado del cliente: sin sesión se vuelve al login.
    if (!sesion) {
      return (
        <Login
          onVolver={volverAlInicio}
          onSesionIniciada={alIniciarSesion}
          onRecuperar={(correo) => {
            setCorreoRecuperacion(correo || '')
            irA(RUTAS.recuperacion)
          }}
        />
      )
    }
    return (
      <PanelAdmin
        sesion={sesion}
        onCerrarSesion={cerrarSesion}
        onVolverAlMuseo={volverAlInicio}
      />
    )
  }

  // Sitio público: cabecera y pie comunes a todas las páginas.
  const pagina = esPaginaPublica(ruta) ? ruta : 'noEncontrada'

  return (
    <div className="app">
      <Navbar paginaActual={pagina} />
      <main className="app__principal">
        <Suspense fallback={<CargandoPagina />}>
          {pagina === 'inicio' && <PaginaInicio />}
          {pagina === 'salas' && (
            <PaginaSalas
              salas={salas}
              cargando={cargandoSalas}
              error={errorSalas}
              onReintentar={reintentar}
              onSeleccionarSala={abrirSala}
            />
          )}
          {pagina === 'acerca' && <PaginaAcerca />}
          {pagina === 'experiencia' && <PaginaExperiencia />}
          {pagina === 'noEncontrada' && <PaginaNoEncontrada />}
        </Suspense>
      </main>
      <Footer sesion={sesion} />
      <ModalSala sala={salaActiva} onCerrar={cerrarSala} />
    </div>
  )
}
