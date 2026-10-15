import { useState } from 'react'
import { iniciarSesion, ErrorAutenticacion } from '../data/authApi'
import { guardarSesion } from '../data/sessionService'
import {
  IconoTemplo,
  IconoSobre,
  IconoCandado,
  IconoOjo,
  IconoCasa,
  IconoAdvertencia,
} from './iconos'
import '../Login.css'

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login({ onVolver, onRecuperar, onSesionIniciada }) {
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [mostrarClave, setMostrarClave] = useState(false)
  const [recordarme, setRecordarme] = useState(false)
  const [errores, setErrores] = useState({})
  const [errorAuth, setErrorAuth] = useState('')
  const [aviso, setAviso] = useState('')
  const [estado, setEstado] = useState('inactivo')

  const cargando = estado === 'cargando'
  const exito = estado === 'exito'

  const validar = () => {
    const nuevos = {}
    if (!correo.trim()) {
      nuevos.correo = 'Ingresa tu correo electrónico.'
    } else if (!CORREO_VALIDO.test(correo.trim())) {
      nuevos.correo = 'El correo no tiene un formato válido.'
    }
    if (!contrasena) {
      nuevos.contrasena = 'Ingresa tu contraseña.'
    }
    setErrores(nuevos)
    return Object.keys(nuevos).length === 0
  }

  const enviar = async (evento) => {
    evento.preventDefault()
    if (cargando) return

    setErrorAuth('')
    setAviso('')

    if (!validar()) return

    setEstado('cargando')
    try {
      const resultado = await iniciarSesion({
        correo: correo.trim(),
        contrasena,
      })
      // Se conservan los campos reales del backend:
      // token, tipo, correo, rol, debeCambiarContrasena, expiraEnMinutos.
      const sesion = guardarSesion(resultado)
      setEstado('exito')
      setAviso(
        sesion.debeCambiarContrasena
          ? 'Sesión iniciada. Debes cambiar tu contraseña para continuar.'
          : 'Sesión iniciada correctamente.',
      )
      onSesionIniciada?.(sesion)
    } catch (error) {
      setEstado('inactivo')
      if (error instanceof ErrorAutenticacion) {
        if (error.erroresValidacion) {
          const porCampo = {}
          if (error.erroresValidacion.correo) porCampo.correo = error.erroresValidacion.correo
          if (error.erroresValidacion.contrasena) {
            porCampo.contrasena = error.erroresValidacion.contrasena
          }
          if (Object.keys(porCampo).length) setErrores(porCampo)
        }
        setErrorAuth(error.message)
      } else {
        setErrorAuth('Ocurrió un error inesperado. Inténtalo de nuevo.')
      }
    }
  }

  const irARecuperacion = () => {
    if (cargando) return
    onRecuperar?.(correo.trim())
  }

  return (
    <div className="login">
      <main className="login__panel" aria-labelledby="login-titulo">
        <div className="login__marca">
          <IconoTemplo className="login__marca-icono" />
          <span className="login__marca-texto">
            Museo<em>_Smart</em>
          </span>
        </div>

        <header className="login__cabecera">
          <h1 className="login__titulo" id="login-titulo">
            Iniciar sesión
          </h1>
          <p className="login__subtitulo">Accede a Museo Smart.</p>
        </header>

        <form className="login__form" onSubmit={enviar} noValidate>
          <div className="campo">
            <label className="campo__etiqueta" htmlFor="login-correo">
              Correo electrónico
            </label>
            <div
              className={`campo__control${errores.correo ? ' campo__control--error' : ''}`}
            >
              <span className="campo__icono" aria-hidden="true">
                <IconoSobre />
              </span>
              <input
                className="campo__input"
                id="login-correo"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="ejemplo@correo.com"
                value={correo}
                disabled={cargando}
                aria-invalid={errores.correo ? 'true' : undefined}
                aria-describedby={errores.correo ? 'login-correo-error' : undefined}
                onChange={(evento) => {
                  setCorreo(evento.target.value)
                  if (errores.correo) setErrores((p) => ({ ...p, correo: '' }))
                }}
              />
            </div>
            {errores.correo && (
              <p className="campo__error" id="login-correo-error">
                <span aria-hidden="true">•</span> {errores.correo}
              </p>
            )}
          </div>

          <div className="campo">
            <label className="campo__etiqueta" htmlFor="login-contrasena">
              Contraseña
            </label>
            <div
              className={`campo__control${errores.contrasena ? ' campo__control--error' : ''}`}
            >
              <span className="campo__icono" aria-hidden="true">
                <IconoCandado />
              </span>
              <input
                className="campo__input"
                id="login-contrasena"
                type={mostrarClave ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                value={contrasena}
                disabled={cargando}
                aria-invalid={errores.contrasena ? 'true' : undefined}
                aria-describedby={
                  errores.contrasena ? 'login-contrasena-error' : undefined
                }
                onChange={(evento) => {
                  setContrasena(evento.target.value)
                  if (errores.contrasena) {
                    setErrores((p) => ({ ...p, contrasena: '' }))
                  }
                }}
              />
              <button
                type="button"
                className="campo__ver"
                onClick={() => setMostrarClave((valor) => !valor)}
                aria-label={
                  mostrarClave ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
                aria-pressed={mostrarClave}
                disabled={cargando}
              >
                <IconoOjo abierto={mostrarClave} />
              </button>
            </div>
            {errores.contrasena && (
              <p className="campo__error" id="login-contrasena-error">
                <span aria-hidden="true">•</span> {errores.contrasena}
              </p>
            )}
          </div>

          <div className="login__opciones">
            <label className="recordar">
              <input
                type="checkbox"
                checked={recordarme}
                disabled={cargando}
                onChange={(evento) => setRecordarme(evento.target.checked)}
              />
              <span>Recordarme</span>
            </label>

            <button
              type="button"
              className="login__recuperar"
              onClick={irARecuperacion}
              disabled={cargando}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button
            type="submit"
            className="login__boton"
            disabled={cargando || exito}
          >
            {cargando ? (
              <>
                <span className="login__spinner" aria-hidden="true" />
                Iniciando sesión…
              </>
            ) : (
              <>
                Iniciar sesión <span aria-hidden="true">→</span>
              </>
            )}
          </button>

          {errorAuth && (
            <p className="login__alerta login__alerta--error" role="alert">
              <span className="login__alerta-icono" aria-hidden="true">
                <IconoAdvertencia />
              </span>
              {errorAuth}
            </p>
          )}

          {aviso && (
            <p className="login__alerta login__alerta--aviso" role="status">
              {aviso}
            </p>
          )}
        </form>

        <div className="login__separador" aria-hidden="true">
          <span className="login__separador-linea" />
          <IconoTemplo className="login__separador-icono" />
          <span className="login__separador-linea" />
        </div>

        <button type="button" className="login__volver" onClick={onVolver}>
          <IconoCasa />
          Volver al museo virtual
        </button>
      </main>

      <footer className="login__pie">
        <p className="login__pie-titulo">Museo del Patrimonio Colombiano</p>
        <p className="login__pie-creditos">
          © 2026 Museo_Smart. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  )
}
