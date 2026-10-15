import { useState } from 'react'
import {
  IconoAdmin,
  IconoCamara,
  IconoCorona,
  IconoInfo,
  IconoCampana,
  IconoAdvertencia,
  IconoExclamacion,
  IconoAjustes,
  IconoCandado,
  IconoOjo,
  IconoCheck,
  IconoEscudo,
  IconoCalendario,
  IconoReloj,
  IconoMonitor,
  IconoDispositivo,
  IconoLlave,
} from './iconos'
import './MiPerfil.css'

export default function MiPerfil({ sesion }) {
  // Datos del perfil
  const [nombre, setNombre] = useState(sesion?.nombre || 'Gabs')
  const correo = sesion?.correo || '6gabymorales@gmail.com'
  const rol = sesion?.rol || 'SuperAdmin'

  // Preferencias de notificaciones
  const [notifCriticas, setNotifCriticas] = useState(true)
  const [notifAdvertencia, setNotifAdvertencia] = useState(true)
  const [notifSistema, setNotifSistema] = useState(true)

  // Cambio de contraseña
  const [passActual, setPassActual] = useState('')
  const [passNueva, setPassNueva] = useState('')
  const [passConfirmar, setPassConfirmar] = useState('')

  const [verActual, setVerActual] = useState(false)
  const [verNueva, setVerNueva] = useState(false)
  const [verConfirmar, setVerConfirmar] = useState(false)

  const [mensajeExito, setMensajeExito] = useState('')
  const [mensajeError, setMensajeError] = useState('')

  // Validaciones en tiempo real de la nueva contraseña
  const tieneMinimo8 = passNueva.length >= 8
  const tieneMayuscula = /[A-Z]/.test(passNueva)
  const tieneMinuscula = /[a-z]/.test(passNueva)
  const tieneNumero = /[0-9]/.test(passNueva)
  const tieneEspecial = /[!@#$%^&*(),.?":{}|<>]/.test(passNueva)

  const todosRequisitos =
    tieneMinimo8 && tieneMayuscula && tieneMinuscula && tieneNumero && tieneEspecial

  const handleActualizarPassword = (e) => {
    e.preventDefault()
    setMensajeError('')
    setMensajeExito('')

    if (!passActual) {
      setMensajeError('Por favor ingresa tu contraseña actual.')
      return
    }

    if (!todosRequisitos) {
      setMensajeError('La nueva contraseña no cumple todos los requisitos de seguridad.')
      return
    }

    if (passNueva !== passConfirmar) {
      setMensajeError('La nueva contraseña y su confirmación no coinciden.')
      return
    }

    setMensajeExito('Contraseña actualizada correctamente (simulación de datos).')
    setPassActual('')
    setPassNueva('')
    setPassConfirmar('')
    setTimeout(() => setMensajeExito(''), 4000)
  }

  return (
    <div className="mi-perfil-vista">
      {/* ===================== Cabecera de Página ===================== */}
      <header className="perfil-cabecera">
        <h1 className="perfil-cabecera__titulo">Mi perfil</h1>
        <p className="perfil-cabecera__subtitulo">
          Consulta y actualiza tu información personal y de acceso al sistema.
        </p>
      </header>

      {/* ===================== Contenedor 2 Columnas ===================== */}
      <div className="perfil-grid">
        {/* ===================== COLUMNA IZQUIERDA ===================== */}
        <div className="perfil-columna">
          {/* Tarjeta: Información personal */}
          <article className="perfil-card">
            <header className="perfil-card__header">
              <span className="perfil-card__header-icono">
                <IconoAdmin />
              </span>
              <h2 className="perfil-card__titulo">Información personal</h2>
            </header>

            <div className="perfil-card__cuerpo">
              {/* Avatar y Datos Principales */}
              <div className="perfil-avatar-seccion">
                <div className="perfil-avatar-wrap">
                  <div className="perfil-avatar-letra">{nombre.charAt(0) || 'G'}</div>
                  <button
                    type="button"
                    className="perfil-avatar-camara"
                    aria-label="Cambiar foto de perfil"
                    title="Cambiar foto"
                  >
                    <IconoCamara />
                  </button>
                </div>
                <div className="perfil-avatar-meta">
                  <div className="perfil-avatar-nombre-fila">
                    <span className="perfil-avatar-nombre">{nombre}</span>
                    <span className="perfil-avatar-corona">
                      <IconoCorona />
                    </span>
                  </div>
                  <span className="perfil-avatar-rol">{rol}</span>
                </div>
              </div>

              {/* Formulario de Información Personal */}
              <div className="perfil-campo">
                <label htmlFor="perfil-nombre" className="perfil-campo__label">
                  Nombre completo
                </label>
                <input
                  id="perfil-nombre"
                  type="text"
                  className="perfil-campo__input"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>

              <div className="perfil-campo">
                <label htmlFor="perfil-correo" className="perfil-campo__label">
                  Correo electrónico
                </label>
                <input
                  id="perfil-correo"
                  type="email"
                  className="perfil-campo__input perfil-campo__input--deshabilitado"
                  value={correo}
                  disabled
                  readOnly
                />
              </div>

              <div className="perfil-campo">
                <label htmlFor="perfil-rol" className="perfil-campo__label">
                  Rol
                </label>
                <input
                  id="perfil-rol"
                  type="text"
                  className="perfil-campo__input perfil-campo__input--deshabilitado"
                  value={rol}
                  disabled
                  readOnly
                />
              </div>

              {/* Mensaje de aviso informativo */}
              <div className="perfil-aviso-info" role="note">
                <span className="perfil-aviso-info__icono">
                  <IconoInfo />
                </span>
                <p className="perfil-aviso-info__texto">
                  Tu rol y correo electrónico no pueden ser modificados. Si necesitas actualizar esta información, contacta al administrador del sistema.
                </p>
              </div>
            </div>
          </article>

          {/* Tarjeta: Preferencias de notificaciones */}
          <article className="perfil-card">
            <header className="perfil-card__header">
              <span className="perfil-card__header-icono">
                <IconoCampana />
              </span>
              <div className="perfil-card__header-textos">
                <h2 className="perfil-card__titulo">Preferencias de notificaciones</h2>
                <p className="perfil-card__subtitulo">
                  Selecciona las notificaciones que deseas recibir en el sistema.
                </p>
              </div>
            </header>

            <div className="perfil-card__cuerpo perfil-notificaciones-lista">
              {/* Notif 1 */}
              <div className="notif-fila">
                <div className="notif-fila__icono notif-fila__icono--alerta">
                  <IconoAdvertencia />
                </div>
                <div className="notif-fila__textos">
                  <span className="notif-fila__titulo">Alertas críticas de sensores IoT</span>
                  <span className="notif-fila__desc">
                    Notificaciones de eventos críticos en tiempo real.
                  </span>
                </div>
                <label className="switch-toggle" aria-label="Alertas críticas de sensores IoT">
                  <input
                    type="checkbox"
                    checked={notifCriticas}
                    onChange={(e) => setNotifCriticas(e.target.checked)}
                  />
                  <span className="switch-slider" />
                </label>
              </div>

              {/* Notif 2 */}
              <div className="notif-fila">
                <div className="notif-fila__icono notif-fila__icono--aviso">
                  <IconoExclamacion />
                </div>
                <div className="notif-fila__textos">
                  <span className="notif-fila__titulo">Alertas de advertencia</span>
                  <span className="notif-fila__desc">
                    Notificaciones de eventos que requieren revisión.
                  </span>
                </div>
                <label className="switch-toggle" aria-label="Alertas de advertencia">
                  <input
                    type="checkbox"
                    checked={notifAdvertencia}
                    onChange={(e) => setNotifAdvertencia(e.target.checked)}
                  />
                  <span className="switch-slider" />
                </label>
              </div>

              {/* Notif 3 */}
              <div className="notif-fila">
                <div className="notif-fila__icono notif-fila__icono--sistema">
                  <IconoAjustes />
                </div>
                <div className="notif-fila__textos">
                  <span className="notif-fila__titulo">Notificaciones del sistema</span>
                  <span className="notif-fila__desc">
                    Actualizaciones importantes del sistema.
                  </span>
                </div>
                <label className="switch-toggle" aria-label="Notificaciones del sistema">
                  <input
                    type="checkbox"
                    checked={notifSistema}
                    onChange={(e) => setNotifSistema(e.target.checked)}
                  />
                  <span className="switch-slider" />
                </label>
              </div>
            </div>
          </article>
        </div>

        {/* ===================== COLUMNA DERECHA ===================== */}
        <div className="perfil-columna">
          {/* Tarjeta: Cambiar contraseña */}
          <article className="perfil-card">
            <header className="perfil-card__header">
              <span className="perfil-card__header-icono">
                <IconoCandado />
              </span>
              <h2 className="perfil-card__titulo">Cambiar contraseña</h2>
            </header>

            <form className="perfil-card__cuerpo" onSubmit={handleActualizarPassword}>
              <div className="perfil-campo">
                <label htmlFor="pass-actual" className="perfil-campo__label">
                  Contraseña actual
                </label>
                <div className="perfil-input-password-wrap">
                  <input
                    id="pass-actual"
                    type={verActual ? 'text' : 'password'}
                    className="perfil-campo__input"
                    placeholder="Ingresa tu contraseña actual"
                    value={passActual}
                    onChange={(e) => setPassActual(e.target.value)}
                  />
                  <button
                    type="button"
                    className="perfil-btn-ojo"
                    onClick={() => setVerActual((v) => !v)}
                    aria-label={verActual ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    <IconoOjo abierto={verActual} />
                  </button>
                </div>
              </div>

              <div className="perfil-campo">
                <label htmlFor="pass-nueva" className="perfil-campo__label">
                  Nueva contraseña
                </label>
                <div className="perfil-input-password-wrap">
                  <input
                    id="pass-nueva"
                    type={verNueva ? 'text' : 'password'}
                    className="perfil-campo__input"
                    placeholder="Ingresa tu nueva contraseña"
                    value={passNueva}
                    onChange={(e) => setPassNueva(e.target.value)}
                  />
                  <button
                    type="button"
                    className="perfil-btn-ojo"
                    onClick={() => setVerNueva((v) => !v)}
                    aria-label={verNueva ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    <IconoOjo abierto={verNueva} />
                  </button>
                </div>
              </div>

              <div className="perfil-campo">
                <label htmlFor="pass-confirmar" className="perfil-campo__label">
                  Confirmar nueva contraseña
                </label>
                <div className="perfil-input-password-wrap">
                  <input
                    id="pass-confirmar"
                    type={verConfirmar ? 'text' : 'password'}
                    className="perfil-campo__input"
                    placeholder="Confirma tu nueva contraseña"
                    value={passConfirmar}
                    onChange={(e) => setPassConfirmar(e.target.value)}
                  />
                  <button
                    type="button"
                    className="perfil-btn-ojo"
                    onClick={() => setVerConfirmar((v) => !v)}
                    aria-label={verConfirmar ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    <IconoOjo abierto={verConfirmar} />
                  </button>
                </div>
              </div>

              {/* Caja de Requisitos */}
              <div className="perfil-requisitos-box">
                <span className="perfil-requisitos-titulo">Requisitos de la contraseña:</span>
                <ul className="perfil-requisitos-lista">
                  <li className={`requisito-item${tieneMinimo8 ? ' requisito-item--cumplido' : ''}`}>
                    <span className="requisito-check">
                      <IconoCheck />
                    </span>
                    <span>Mínimo 8 caracteres</span>
                  </li>
                  <li className={`requisito-item${tieneMayuscula ? ' requisito-item--cumplido' : ''}`}>
                    <span className="requisito-check">
                      <IconoCheck />
                    </span>
                    <span>Al menos una letra mayúscula</span>
                  </li>
                  <li className={`requisito-item${tieneMinuscula ? ' requisito-item--cumplido' : ''}`}>
                    <span className="requisito-check">
                      <IconoCheck />
                    </span>
                    <span>Al menos una letra minúscula</span>
                  </li>
                  <li className={`requisito-item${tieneNumero ? ' requisito-item--cumplido' : ''}`}>
                    <span className="requisito-check">
                      <IconoCheck />
                    </span>
                    <span>Al menos un número</span>
                  </li>
                  <li className={`requisito-item${tieneEspecial ? ' requisito-item--cumplido' : ''}`}>
                    <span className="requisito-check">
                      <IconoCheck />
                    </span>
                    <span>Al menos un carácter especial (ej. !@#$% )</span>
                  </li>
                </ul>
              </div>

              {mensajeError && <div className="perfil-alerta-error">{mensajeError}</div>}
              {mensajeExito && <div className="perfil-alerta-exito">{mensajeExito}</div>}

              <div className="perfil-accion-wrap">
                <button type="submit" className="perfil-btn-actualizar">
                  <IconoLlave />
                  <span>Actualizar contraseña</span>
                </button>
              </div>
            </form>
          </article>

          {/* Tarjeta: Información de la cuenta */}
          <article className="perfil-card">
            <header className="perfil-card__header">
              <span className="perfil-card__header-icono">
                <IconoEscudo />
              </span>
              <h2 className="perfil-card__titulo">Información de la cuenta</h2>
            </header>

            <div className="perfil-card__cuerpo perfil-info-cuenta-lista">
              <div className="cuenta-dato-fila">
                <span className="cuenta-dato__icono">
                  <IconoCalendario />
                </span>
                <span className="cuenta-dato__label">Fecha de creación</span>
                <span className="cuenta-dato__valor">01/10/2026 09:15 a. m.</span>
              </div>

              <div className="cuenta-dato-fila">
                <span className="cuenta-dato__icono">
                  <IconoReloj />
                </span>
                <span className="cuenta-dato__label">Última actualización</span>
                <span className="cuenta-dato__valor">01/10/2026 09:15 a. m.</span>
              </div>

              <div className="cuenta-dato-fila">
                <span className="cuenta-dato__icono">
                  <IconoLlave />
                </span>
                <span className="cuenta-dato__label">Último inicio de sesión</span>
                <span className="cuenta-dato__valor">13/10/2026 10:24 a. m.</span>
              </div>

              <div className="cuenta-dato-fila">
                <span className="cuenta-dato__icono">
                  <IconoMonitor />
                </span>
                <span className="cuenta-dato__label">Dirección IP (último acceso)</span>
                <span className="cuenta-dato__valor">181.62.12.45</span>
              </div>

              <div className="cuenta-dato-fila">
                <span className="cuenta-dato__icono">
                  <IconoDispositivo />
                </span>
                <span className="cuenta-dato__label">Dispositivo (último acceso)</span>
                <span className="cuenta-dato__valor">Windows · Chrome</span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}
