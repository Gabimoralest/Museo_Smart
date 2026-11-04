import { useEffect, useRef, useState } from 'react'

export default function ModalIngreso({ abierto, onCerrar }) {
  const cerrarRef = useRef(null)
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    if (!abierto) return undefined

    const alPulsarTecla = (evento) => {
      if (evento.key === 'Escape') onCerrar()
    }

    document.addEventListener('keydown', alPulsarTecla)
    document.body.style.overflow = 'hidden'
    cerrarRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', alPulsarTecla)
      document.body.style.overflow = ''
    }
  }, [abierto, onCerrar])

  useEffect(() => {
    if (!abierto) {
      setUsuario('')
      setClave('')
      setAviso('')
    }
  }, [abierto])

  if (!abierto) return null

  const enviar = (evento) => {
    evento.preventDefault()
    setAviso(
      'El acceso de administrador aún no está conectado al servidor. Esta vista es solo la interfaz.',
    )
  }

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingreso-titulo"
      onClick={onCerrar}
    >
      <div
        className="modal__caja modal__caja--angosta"
        onClick={(evento) => evento.stopPropagation()}
      >
        <button
          type="button"
          className="modal__cerrar"
          ref={cerrarRef}
          onClick={onCerrar}
          aria-label="Cerrar ventana"
        >
          ×
        </button>

        <div className="modal__cuerpo">
          <span className="modal__nombre">Acceso restringido</span>
          <h3 className="modal__titulo" id="ingreso-titulo">
            Ingreso de administrador
          </h3>
          <p className="modal__descripcion">
            Solo el personal autorizado del museo puede ingresar. Los visitantes
            pueden recorrer las salas sin registrarse.
          </p>

          <form className="ingreso" onSubmit={enviar}>
            <label className="ingreso__campo">
              <span>Usuario</span>
              <input
                type="text"
                value={usuario}
                autoComplete="username"
                onChange={(evento) => setUsuario(evento.target.value)}
                placeholder="administrador"
              />
            </label>

            <label className="ingreso__campo">
              <span>Contraseña</span>
              <input
                type="password"
                value={clave}
                autoComplete="current-password"
                onChange={(evento) => setClave(evento.target.value)}
                placeholder="••••••••"
              />
            </label>

            {aviso && <p className="ingreso__aviso">{aviso}</p>}

            <button type="submit" className="modal__accion">
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
