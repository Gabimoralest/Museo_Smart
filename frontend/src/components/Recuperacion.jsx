import { useEffect, useRef, useState } from 'react'
import {
  solicitarRecuperacion,
  verificarCodigo,
  restablecerContrasena,
  ErrorAutenticacion,
  LONGITUD_MINIMA_CONTRASENA,
} from '../data/authApi'
import {
  IconoTemplo,
  IconoSobre,
  IconoCandado,
  IconoOjo,
  IconoCasa,
  IconoAdvertencia,
  IconoCheck,
  IconoFlechaIzquierda,
} from './iconos'
import '../Login.css'
import './Recuperacion.css'

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LONGITUD_CODIGO = 6

const PASOS = ['Correo', 'Código', 'Contraseña']

// El backend exige únicamente longitud mínima (RestablecerContrasenaRequest).
// Mayúscula y número se muestran como recomendaciones, nunca como reglas reales.
const REQUISITOS = [
  {
    clave: 'longitud',
    etiqueta: `Mínimo ${LONGITUD_MINIMA_CONTRASENA} caracteres`,
    obligatorio: true,
    cumple: (valor) => valor.length >= LONGITUD_MINIMA_CONTRASENA,
  },
  {
    clave: 'mayuscula',
    etiqueta: 'Al menos una letra mayúscula (recomendado)',
    obligatorio: false,
    cumple: (valor) => /[A-ZÁÉÍÓÚÑ]/.test(valor),
  },
  {
    clave: 'numero',
    etiqueta: 'Al menos un número (recomendado)',
    obligatorio: false,
    cumple: (valor) => /\d/.test(valor),
  },
]

function IndicadorPasos({ actual }) {
  return (
    <ol className="recuperar__pasos" aria-label="Progreso de la recuperación">
      {PASOS.map((nombre, indice) => {
        const numero = indice + 1
        const completado = actual > numero
        const activo = actual === numero
        const estado = completado
          ? 'completado'
          : activo
            ? 'activo'
            : 'pendiente'
        return (
          <li
            key={nombre}
            className={`recuperar__paso recuperar__paso--${estado}`}
            aria-current={activo ? 'step' : undefined}
          >
            <span className="recuperar__paso-marca" aria-hidden="true">
              {completado ? <IconoCheck /> : numero}
            </span>
            <span className="recuperar__paso-nombre">{nombre}</span>
          </li>
        )
      })}
    </ol>
  )
}

function CampoContrasena({
  id,
  etiqueta,
  valor,
  nombreError,
  error,
  disabled,
  visible,
  onAlternarVisible,
  onChange,
}) {
  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <div className={`campo__control${error ? ' campo__control--error' : ''}`}>
        <span className="campo__icono" aria-hidden="true">
          <IconoCandado />
        </span>
        <input
          className="campo__input"
          id={id}
          name={nombreError}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Ingresa tu contraseña"
          value={valor}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={onChange}
        />
        <button
          type="button"
          className="campo__ver"
          onClick={onAlternarVisible}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          disabled={disabled}
        >
          <IconoOjo abierto={visible} />
        </button>
      </div>
      {error && (
        <p className="campo__error" id={`${id}-error`}>
          <span aria-hidden="true">•</span> {error}
        </p>
      )}
    </div>
  )
}

export default function Recuperacion({ onVolverAlLogin, onVolverAlMuseo, correoInicial = '' }) {
  const [paso, setPaso] = useState(1)
  const [correo, setCorreo] = useState(correoInicial)
  const [codigo, setCodigo] = useState(Array(LONGITUD_CODIGO).fill(''))
  const [tokenRestablecimiento, setTokenRestablecimiento] = useState('')
  const [nuevaContrasena, setNuevaContrasena] = useState('')
  const [confirmarContrasena, setConfirmarContrasena] = useState('')
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false)
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [aviso, setAviso] = useState('')
  const [estado, setEstado] = useState('inactivo')
  const refsCodigo = useRef([])

  const cargando = estado === 'cargando'
  const codigoCompleto = codigo.join('')

  const limpiarMensajes = () => {
    setErrorGeneral('')
    setAviso('')
  }

  // ---- Paso 1: solicitar código ----
  const enviarSolicitud = async (evento) => {
    evento?.preventDefault()
    if (cargando) return
    limpiarMensajes()

    const limpioCorreo = correo.trim()
    if (!limpioCorreo) {
      setErrores({ correo: 'Ingresa tu correo electrónico.' })
      return
    }
    if (!CORREO_VALIDO.test(limpioCorreo)) {
      setErrores({ correo: 'El correo no tiene un formato válido.' })
      return
    }
    setErrores({})

    setEstado('cargando')
    try {
      await solicitarRecuperacion({ correo: limpioCorreo })
      setCorreo(limpioCorreo)
      setCodigo(Array(LONGITUD_CODIGO).fill(''))
      setPaso(2)
      setAviso('')
      setEstado('inactivo')
      // Enfocar la primera casilla del código.
      requestAnimationFrame(() => refsCodigo.current[0]?.focus())
    } catch (error) {
      setEstado('inactivo')
      aplicarError(error, {
        400: 'Revisa el correo ingresado.',
        fallback: 'No pudimos procesar la solicitud. Inténtalo de nuevo.',
      })
    }
  }

  // ---- Paso 2: verificar código ----
  const verificar = async (evento) => {
    evento?.preventDefault()
    if (cargando) return
    limpiarMensajes()

    if (codigoCompleto.length !== LONGITUD_CODIGO) {
      setErrores({ codigo: 'Ingresa los 6 dígitos del código.' })
      return
    }
    setErrores({})

    setEstado('cargando')
    try {
      const { tokenRestablecimiento: token } = await verificarCodigo({
        correo: correo.trim(),
        codigo: codigoCompleto,
      })
      setTokenRestablecimiento(token)
      setNuevaContrasena('')
      setConfirmarContrasena('')
      setPaso(3)
      setEstado('inactivo')
    } catch (error) {
      setEstado('inactivo')
      aplicarError(error, {
        400: 'El código de recuperación no es válido o ha expirado.',
        fallback: 'No pudimos verificar el código. Inténtalo de nuevo.',
      })
    }
  }

  const reenviarCodigo = async () => {
    if (cargando) return
    limpiarMensajes()
    setErrores({})

    setEstado('cargando')
    try {
      await solicitarRecuperacion({ correo: correo.trim() })
      setCodigo(Array(LONGITUD_CODIGO).fill(''))
      setAviso('Si el correo está registrado, enviamos un nuevo código.')
      requestAnimationFrame(() => refsCodigo.current[0]?.focus())
    } catch (error) {
      aplicarError(error, {
        fallback: 'No pudimos reenviar el código en este momento. Inténtalo más tarde.',
      })
    } finally {
      setEstado('inactivo')
    }
  }

  // ---- Paso 3: restablecer ----
  const guardarContrasena = async (evento) => {
    evento?.preventDefault()
    if (cargando) return
    limpiarMensajes()

    const validaciones = {}
    if (!nuevaContrasena) {
      validaciones.nueva = 'Ingresa tu nueva contraseña.'
    } else if (nuevaContrasena.length < LONGITUD_MINIMA_CONTRASENA) {
      validaciones.nueva = `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`
    }
    if (!confirmarContrasena) {
      validaciones.confirmar = 'Confirma tu nueva contraseña.'
    } else if (nuevaContrasena !== confirmarContrasena) {
      validaciones.confirmar = 'Las contraseñas no coinciden.'
    }
    if (Object.keys(validaciones).length) {
      setErrores(validaciones)
      return
    }
    setErrores({})

    setEstado('cargando')
    try {
      await restablecerContrasena({
        tokenRestablecimiento,
        nuevaContrasena,
      })
      setPaso(4)
      setEstado('exito')
    } catch (error) {
      setEstado('inactivo')
      aplicarError(error, {
        400: 'El enlace de recuperación no es válido o ha expirado. Solicita uno nuevo.',
        fallback: 'No pudimos cambiar la contraseña. Inténtalo de nuevo.',
      })
    }
  }

  function aplicarError(error, { 400: mensaje400, fallback } = {}) {
    if (error instanceof ErrorAutenticacion) {
      if (error.erroresValidacion) {
        const porCampo = {}
        if (error.erroresValidacion.correo) porCampo.correo = 'El correo no tiene un formato válido.'
        if (error.erroresValidacion.codigo) porCampo.codigo = 'El código debe tener 6 dígitos.'
        if (error.erroresValidacion.nuevaContrasena) {
          porCampo.nueva = `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`
        }
        if (Object.keys(porCampo).length) setErrores(porCampo)
      }
      setErrorGeneral(
        error.estado === 400 && mensaje400 ? mensaje400 : error.message || fallback,
      )
    } else {
      setErrorGeneral(fallback || 'Ocurrió un error inesperado. Inténtalo de nuevo.')
    }
  }

  // ---- Manejo de las casillas del código ----
  const escribirDigito = (indice, valorCrudo) => {
    const soloDigitos = valorCrudo.replace(/\D/g, '')
    if (!soloDigitos) return
    setCodigo((previos) => {
      const siguiente = [...previos]
      // Si pegan varios dígitos en una casilla, se distribuyen.
      for (let i = 0; i < soloDigitos.length && indice + i < LONGITUD_CODIGO; i += 1) {
        siguiente[indice + i] = soloDigitos[i]
      }
      return siguiente
    })
    if (errores.codigo) setErrores((p) => ({ ...p, codigo: '' }))
    const destino = Math.min(indice + soloDigitos.length, LONGITUD_CODIGO - 1)
    refsCodigo.current[destino]?.focus()
  }

  const manejarTecla = (indice, evento) => {
    if (evento.key === 'Backspace') {
      evento.preventDefault()
      setCodigo((previos) => {
        const siguiente = [...previos]
        if (siguiente[indice]) {
          siguiente[indice] = ''
        } else if (indice > 0) {
          siguiente[indice - 1] = ''
          refsCodigo.current[indice - 1]?.focus()
        }
        return siguiente
      })
      return
    }
    if (evento.key === 'ArrowLeft' && indice > 0) {
      evento.preventDefault()
      refsCodigo.current[indice - 1]?.focus()
    }
    if (evento.key === 'ArrowRight' && indice < LONGITUD_CODIGO - 1) {
      evento.preventDefault()
      refsCodigo.current[indice + 1]?.focus()
    }
  }

  const pegarCodigo = (evento) => {
    const texto = (evento.clipboardData?.getData('text') || '').replace(/\D/g, '')
    if (!texto) return
    evento.preventDefault()
    const digitos = texto.slice(0, LONGITUD_CODIGO).split('')
    const siguiente = Array(LONGITUD_CODIGO).fill('')
    digitos.forEach((d, i) => {
      siguiente[i] = d
    })
    setCodigo(siguiente)
    if (errores.codigo) setErrores((p) => ({ ...p, codigo: '' }))
    const destino = Math.min(digitos.length, LONGITUD_CODIGO - 1)
    refsCodigo.current[destino]?.focus()
  }

  useEffect(() => {
    if (paso === 2) {
      refsCodigo.current[0]?.focus()
    }
  }, [paso])

  const volverAlLogin = () => onVolverAlLogin?.()

  // ================= Render =================
  return (
    <div className="login">
      <main className="login__panel" aria-labelledby="recuperar-titulo">
        <div className="login__marca">
          <IconoTemplo className="login__marca-icono" />
          <span className="login__marca-texto">
            Museo<em>_Smart</em>
          </span>
        </div>

        {paso <= 3 && <IndicadorPasos actual={paso} />}

        {paso === 1 && (
          <>
            <header className="login__cabecera">
              <h1 className="login__titulo" id="recuperar-titulo">
                Recuperar contraseña
              </h1>
              <p className="login__subtitulo">
                Ingresa el correo electrónico asociado a tu cuenta para recibir un
                código de verificación.
              </p>
            </header>

            <form className="login__form" onSubmit={enviarSolicitud} noValidate>
              <div className="campo">
                <label className="campo__etiqueta" htmlFor="recuperar-correo">
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
                    id="recuperar-correo"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="nombre@correo.com"
                    value={correo}
                    disabled={cargando}
                    aria-invalid={errores.correo ? 'true' : undefined}
                    aria-describedby={errores.correo ? 'recuperar-correo-error' : undefined}
                    onChange={(evento) => {
                      setCorreo(evento.target.value)
                      if (errores.correo) setErrores((p) => ({ ...p, correo: '' }))
                    }}
                  />
                </div>
                {errores.correo && (
                  <p className="campo__error" id="recuperar-correo-error">
                    <span aria-hidden="true">•</span> {errores.correo}
                  </p>
                )}
              </div>

              <button type="submit" className="login__boton" disabled={cargando}>
                {cargando ? (
                  <>
                    <span className="login__spinner" aria-hidden="true" />
                    Enviando…
                  </>
                ) : (
                  <>
                    Enviar código <span aria-hidden="true">→</span>
                  </>
                )}
              </button>

              {errorGeneral && (
                <p className="login__alerta login__alerta--error" role="alert">
                  <span className="login__alerta-icono" aria-hidden="true">
                    <IconoAdvertencia />
                  </span>
                  {errorGeneral}
                </p>
              )}

              <button type="button" className="login__volver" onClick={volverAlLogin}>
                <IconoFlechaIzquierda />
                Volver
              </button>
            </form>
          </>
        )}

        {paso === 2 && (
          <>
            <header className="login__cabecera">
              <h1 className="login__titulo" id="recuperar-titulo">
                Verifica tu código
              </h1>
              <p className="login__subtitulo">
                Solicitamos un código de recuperación para{' '}
                <strong className="recuperar__correo">{correo}</strong>. Escribe los 6
                dígitos que recibiste.
              </p>
            </header>

            <form className="login__form" onSubmit={verificar} noValidate>
              <div
                className="recuperar__codigo"
                role="group"
                aria-label="Código de verificación de 6 dígitos"
              >
                {codigo.map((digito, indice) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <input
                    key={indice}
                    ref={(elemento) => {
                      refsCodigo.current[indice] = elemento
                    }}
                    className={`recuperar__casilla${errores.codigo ? ' recuperar__casilla--error' : ''}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digito}
                    disabled={cargando}
                    aria-label={`Dígito ${indice + 1} de ${LONGITUD_CODIGO}`}
                    aria-invalid={errores.codigo ? 'true' : undefined}
                    aria-describedby={errores.codigo ? 'recuperar-codigo-error' : undefined}
                    onChange={(evento) => escribirDigito(indice, evento.target.value)}
                    onKeyDown={(evento) => manejarTecla(indice, evento)}
                    onPaste={pegarCodigo}
                    onFocus={(evento) => evento.target.select()}
                  />
                ))}
              </div>

              {errores.codigo && (
                <p className="campo__error" id="recuperar-codigo-error">
                  <span aria-hidden="true">•</span> {errores.codigo}
                </p>
              )}

              <button
                type="submit"
                className="login__boton"
                disabled={cargando || codigoCompleto.length !== LONGITUD_CODIGO}
              >
                {cargando ? (
                  <>
                    <span className="login__spinner" aria-hidden="true" />
                    Verificando…
                  </>
                ) : (
                  'Verificar código'
                )}
              </button>

              {errorGeneral && (
                <p className="login__alerta login__alerta--error" role="alert">
                  <span className="login__alerta-icono" aria-hidden="true">
                    <IconoAdvertencia />
                  </span>
                  {errorGeneral}
                </p>
              )}

              {aviso && (
                <p className="login__alerta login__alerta--aviso" role="status">
                  {aviso}
                </p>
              )}

              <p className="recuperar__reenvio">
                ¿No recibiste el código?{' '}
                <button
                  type="button"
                  className="login__recuperar"
                  onClick={reenviarCodigo}
                  disabled={cargando}
                >
                  Reenviar código
                </button>
              </p>

              <button type="button" className="login__volver" onClick={volverAlLogin}>
                <IconoFlechaIzquierda />
                Volver
              </button>
            </form>
          </>
        )}

        {paso === 3 && (
          <>
            <header className="login__cabecera">
              <h1 className="login__titulo" id="recuperar-titulo">
                Recuperar contraseña
              </h1>
              <p className="login__subtitulo">Ingresa tu nueva contraseña.</p>
            </header>

            <form className="login__form" onSubmit={guardarContrasena} noValidate>
              <CampoContrasena
                id="recuperar-nueva"
                etiqueta="Nueva contraseña"
                valor={nuevaContrasena}
                nombreError="nueva"
                error={errores.nueva}
                disabled={cargando}
                visible={mostrarNueva}
                onAlternarVisible={() => setMostrarNueva((v) => !v)}
                onChange={(evento) => {
                  setNuevaContrasena(evento.target.value)
                  if (errores.nueva) setErrores((p) => ({ ...p, nueva: '' }))
                }}
              />

              <ul className="recuperar__requisitos" aria-live="polite">
                {REQUISITOS.map((requisito) => {
                  const cumple = requisito.cumple(nuevaContrasena)
                  return (
                    <li
                      key={requisito.clave}
                      className={`recuperar__requisito${
                        cumple ? ' recuperar__requisito--cumple' : ''
                      }${requisito.obligatorio ? ' recuperar__requisito--obligatorio' : ''}`}
                    >
                      <span className="recuperar__requisito-marca" aria-hidden="true">
                        {cumple ? <IconoCheck /> : <span className="recuperar__punto" />}
                      </span>
                      {requisito.etiqueta}
                      <span className="recuperar__sr">
                        {requisito.obligatorio ? ' (obligatorio)' : ''}:{' '}
                        {cumple ? 'cumplido' : 'pendiente'}
                      </span>
                    </li>
                  )
                })}
              </ul>

              <CampoContrasena
                id="recuperar-confirmar"
                etiqueta="Confirmar nueva contraseña"
                valor={confirmarContrasena}
                nombreError="confirmar"
                error={errores.confirmar}
                disabled={cargando}
                visible={mostrarConfirmar}
                onAlternarVisible={() => setMostrarConfirmar((v) => !v)}
                onChange={(evento) => {
                  setConfirmarContrasena(evento.target.value)
                  if (errores.confirmar) setErrores((p) => ({ ...p, confirmar: '' }))
                }}
              />

              <button type="submit" className="login__boton" disabled={cargando}>
                {cargando ? (
                  <>
                    <span className="login__spinner" aria-hidden="true" />
                    Guardando…
                  </>
                ) : (
                  'Cambiar contraseña'
                )}
              </button>

              {errorGeneral && (
                <p className="login__alerta login__alerta--error" role="alert">
                  <span className="login__alerta-icono" aria-hidden="true">
                    <IconoAdvertencia />
                  </span>
                  {errorGeneral}
                </p>
              )}
            </form>
          </>
        )}

        {paso === 4 && (
          <div className="recuperar__confirmacion" role="status">
            <span className="recuperar__confirmacion-icono" aria-hidden="true">
              <IconoCheck />
            </span>
            <h1 className="login__titulo" id="recuperar-titulo">
              ¡Contraseña actualizada correctamente!
            </h1>
            <p className="login__subtitulo">
              Tu contraseña se cambió correctamente. Ahora puedes iniciar sesión con
              tu nueva contraseña.
            </p>
            <button type="button" className="login__boton" onClick={volverAlLogin}>
              Volver al inicio de sesión
            </button>
          </div>
        )}

        <div className="login__separador" aria-hidden="true">
          <span className="login__separador-linea" />
          <IconoTemplo className="login__separador-icono" />
          <span className="login__separador-linea" />
        </div>

        <button
          type="button"
          className="login__volver"
          onClick={onVolverAlMuseo}
        >
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
