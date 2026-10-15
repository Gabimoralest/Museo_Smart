import { lazy, Suspense, useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Salas from './components/Salas'
import AcercaDe from './components/AcercaDe'
import Footer from './components/Footer'
import ModalSala from './components/ModalSala'
import Login from './components/Login'
import Recuperacion from './components/Recuperacion'
import PanelAdmin from './components/PanelAdmin'
import { obtenerSesion, limpiarSesion } from './data/sessionService'
import './App.css'

// El visor 3D (three.js + modelo de ~64 MB) se carga solo al entrar en la ruta
// del recorrido, para no penalizar la página principal.
const PaginaRecorrido = lazy(() => import('./components/PaginaRecorrido'))

const RUTA_LOGIN = '#/login'
const RUTA_RECUPERACION = '#/recuperar'
const RUTA_ADMIN = '#/admin'
const RUTA_EXHIBICIONES = '#/admin/exhibiciones'
const RUTA_RECORRIDO = '#/recorrido-virtual'

const leerRuta = () => {
  const hash = window.location.hash
  if (hash === RUTA_LOGIN) return 'login'
  if (hash === RUTA_RECUPERACION) return 'recuperacion'
  if (hash === RUTA_RECORRIDO) return 'recorrido'
  if (
    hash === RUTA_ADMIN ||
    hash === RUTA_EXHIBICIONES ||
    hash.startsWith('#/admin') ||
    hash === '#gestion-exhibiciones'
  ) {
    return 'admin'
  }
  return 'inicio'
}

export default function App() {
  const [salaActiva, setSalaActiva] = useState(null)
  const [ruta, setRuta] = useState(leerRuta)
  const [correoRecuperacion, setCorreoRecuperacion] = useState('')
  const [sesion, setSesion] = useState(obtenerSesion)

  useEffect(() => {
    const alCambiarRuta = () => setRuta(leerRuta())
    window.addEventListener('hashchange', alCambiarRuta)
    return () => window.removeEventListener('hashchange', alCambiarRuta)
  }, [])

  const abrirSala = (sala) => setSalaActiva(sala)
  const cerrarSala = () => setSalaActiva(null)

  const irA = (destino) => {
    window.location.hash = destino
  }

  const abrirIngreso = () => irA(RUTA_LOGIN)

  const volverAlInicio = () => {
    window.location.hash = ''
    window.scrollTo({ top: 0 })
  }

  const cerrarSesion = () => {
    limpiarSesion()
    setSesion(null)
    irA(RUTA_LOGIN)
  }

  // Tras un login correcto: no existe todavía un dashboard administrativo.
  // La navegación dirige a una ruta '#/admin' que informa del estado real
  // (no simula funcionalidad). `debeCambiarContrasena` se respeta mostrando
  // el aviso correspondiente en la pantalla.
  const alIniciarSesion = (nuevaSesion) => {
    setSesion(nuevaSesion)
    irA(RUTA_ADMIN)
  }

  if (ruta === 'login') {
    return (
      <Login
        onVolver={volverAlInicio}
        onSesionIniciada={alIniciarSesion}
        onRecuperar={(correo) => {
          setCorreoRecuperacion(correo || '')
          irA(RUTA_RECUPERACION)
        }}
      />
    )
  }

  if (ruta === 'recuperacion') {
    return (
      <Recuperacion
        correoInicial={correoRecuperacion}
        onVolverAlLogin={() => irA(RUTA_LOGIN)}
        onVolverAlMuseo={volverAlInicio}
      />
    )
  }

  if (ruta === 'recorrido') {
    return (
      <Suspense
        fallback={
          <div className="app">
            <Navbar onIngresar={abrirIngreso} />
            <main className="app__principal" />
          </div>
        }
      >
        <PaginaRecorrido
          onVolver={volverAlInicio}
          onIngresar={abrirIngreso}
        />
      </Suspense>
    )
  }

  if (ruta === 'admin') {
    // Ruta protegida del lado del cliente: sin sesión se vuelve al login.
    // La autorización real la impone el backend en cada endpoint.
    if (!sesion) {
      return (
        <Login
          onVolver={volverAlInicio}
          onSesionIniciada={alIniciarSesion}
          onRecuperar={(correo) => {
            setCorreoRecuperacion(correo || '')
            irA(RUTA_RECUPERACION)
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

  return (
    <div className="app">
      <Navbar onIngresar={abrirIngreso} />
      <main className="app__principal">
        <Hero onSeleccionarSala={abrirSala} />
        <Salas onSeleccionarSala={abrirSala} />
        <AcercaDe />
      </main>
      <Footer />
      <ModalSala sala={salaActiva} onCerrar={cerrarSala} />
    </div>
  )
}
