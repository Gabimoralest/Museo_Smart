// Iconos SVG compartidos por las pantallas de autenticación del museo.
// Se declaran una sola vez para reutilizarlos en Login y Recuperación.

export function IconoTemplo({ className }) {
  return (
    <svg className={className} viewBox="0 0 48 48" role="presentation" aria-hidden="true">
      <path
        d="M24 4 6 14v3h36v-3L24 4Zm-14 16v14h5V20h-5Zm9 0v14h5V20h-5Zm9 0v14h5V20h-5Zm9 0v14h5V20h-5ZM6 37v3h36v-3H6Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoSobre() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm.7 2L12 11.6 19.3 7H4.7ZM5 17h14V8.9l-6.4 4a1 1 0 0 1-1.2 0L5 8.9V17Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoCandado() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M12 3a4 4 0 0 0-4 4v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a4 4 0 0 0-4-4Zm-2 6V7a2 2 0 1 1 4 0v2h-4Zm2 4a1.5 1.5 0 0 1 .75 2.8V17a.75.75 0 0 1-1.5 0v-1.2A1.5 1.5 0 0 1 12 13Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoOjo({ abierto }) {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      {abierto ? (
        <path
          d="M12 5c-5 0-9 4.6-9 7s4 7 9 7 9-4.6 9-7-4-7-9-7Zm0 12c-3.5 0-6.7-3.2-7.6-5C5.3 10.2 8.5 7 12 7s6.7 3.2 7.6 5c-.9 1.8-4.1 5-7.6 5Zm0-7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"
          fill="currentColor"
        />
      ) : (
        <path
          d="M4.3 3 3 4.3l2.3 2.3C3.8 7.7 2.6 9.3 2 11c1 2.4 5 7 10 7 1.7 0 3.3-.5 4.7-1.3L20 20l1.3-1.3L4.3 3ZM12 16c-3.5 0-6.7-3.2-7.6-5 .5-1 1.4-2.2 2.5-3.2l2 2A2.5 2.5 0 0 0 12 13.5c.3 0 .5 0 .7-.1l1.6 1.6c-.7.3-1.5.4-2.3.4Zm1.8-9.7c-.6-.2-1.2-.3-1.8-.3-1 0-2 .2-2.9.5l1.6 1.6c.4-.2.8-.3 1.3-.3 1.4 0 2.5 1.1 2.5 2.5 0 .5-.1.9-.3 1.3l2.1 2.1c1.2-1 2.1-2.1 2.6-3.2-.5-1-1.5-2.6-3.1-3.9Z"
          fill="currentColor"
        />
      )}
    </svg>
  )
}

export function IconoCasa() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M12 3.2 2.5 11h2.3v9h5.4v-5.2h3.6V20h5.4v-9h2.3L12 3.2Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoAdvertencia() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M12 3 1.5 21h21L12 3Zm0 5.5a1 1 0 0 1 1 1v5a1 1 0 0 1-2 0v-5a1 1 0 0 1 1-1Zm0 10.5a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoCheck() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M9.6 16.2 5.4 12l-1.4 1.4 5.6 5.6 12-12L20.2 5.6 9.6 16.2Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoFlechaIzquierda() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2Z"
        fill="currentColor"
      />
    </svg>
  )
}

// ============================================================
// Iconos del panel administrativo (SuperAdmin / Admin).
// Se añaden aquí para mantener un único catálogo de iconos SVG
// reutilizables por toda la aplicación.
// ============================================================

export function IconoInicio() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M3 3h8v8H3V3Zm10 0h8v5h-8V3ZM3 13h8v8H3v-8Zm10-3h8v11h-8V10Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoColeccion() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2v8.6l3.7-3.7 2.8 2.8 3.9-4.6L19 14.3V7H5Zm4 1.2a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoAdmin() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 2c-3.3 0-6 1.8-6 4v2h12v-2c0-2.2-2.7-4-6-4Zm8.5-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm.5 2c-.9 0-1.7.2-2.4.5A6.6 6.6 0 0 1 17 18v1h4v-1.7c0-2-1.9-3.3-3-3.3Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoSensor() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M9 2v2H7a3 3 0 0 0-3 3v2H2v2h2v2H2v2h2v2a3 3 0 0 0 3 3h2v2h2v-2h2v2h2v-2h2a3 3 0 0 0 3-3v-2h2v-2h-2v-2h2V9h-2V7a3 3 0 0 0-3-3h-2V2h-2v2h-2V2H9Zm-.5 5h7A1.5 1.5 0 0 1 17 8.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 15.5v-7A1.5 1.5 0 0 1 8.5 7Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoAlerta() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22Zm6.5-5.3-1.3-1.5v-3.7a5.2 5.2 0 0 0-4-5.1V5a1.2 1.2 0 0 0-2.4 0v1.4a5.2 5.2 0 0 0-4 5.1v3.7l-1.3 1.5a1 1 0 0 0 .7 1.7h11.6a1 1 0 0 0 .7-1.7Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoAnalitica() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M4 20h16v2H4v-2Zm2-6h2.5v5H6v-5Zm4.5-6h2.5v11h-2.5V8Zm4.5 3H17v8h-2.5v-8Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoPanel() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 2v14h4V5H5Zm6 0v14h8V5h-8Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoBuscar() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M10 2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoChevron() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M6.7 9.3 12 14.6l5.3-5.3 1.4 1.4-6.7 6.7-6.7-6.7 1.4-1.4Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoCerrar() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoSalir() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5V3Zm5.6 4-1.4 1.4L16.2 11H9v2h7.2l-2 2.6L15.6 17 20 12l-4.4-5Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoUsuario() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.4-8 5.4V21h16v-1.6c0-3-3.6-5.4-8-5.4Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoReloj() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-1 3v6l5 3 1-1.7-4-2.3V7h-2Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoTendencia() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M3 17.5 9.5 11l3 3L20 6.5 21.4 8l-8.9 8.9-3-3L4.4 19 3 17.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoRayo() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor" />
    </svg>
  )
}

export function IconoMenu() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" fill="currentColor" />
    </svg>
  )
}

export function IconoAntena() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M12 11a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm-1 6.45V22h2v-4.55a4.48 4.48 0 0 0 2.87-1.74l1.42 1.42a6.5 6.5 0 0 0-8.58 0l1.42-1.42A4.48 4.48 0 0 0 11 17.45ZM4.93 7.93l1.41 1.41a9 9 0 0 1 11.32 0l1.41-1.41a11 11 0 0 0-14.14 0Zm2.83 2.83 1.41 1.41a5 5 0 0 1 5.66 0l1.41-1.41a7 7 0 0 0-8.48 0Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoCorona() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="m3 18 1.5-10 4.5 4 3-7 3 7 4.5-4L21 18H3Zm1.5 2h15v1.5h-15V20Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoCampana() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22Zm6.5-5.3-1.3-1.5v-3.7a5.2 5.2 0 0 0-4-5.1V5a1.2 1.2 0 0 0-2.4 0v1.4a5.2 5.2 0 0 0-4 5.1v3.7l-1.3 1.5a1 1 0 0 0 .7 1.7h11.6a1 1 0 0 0 .7-1.7Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoEtiqueta() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="m21.4 11.6-8.5-8.5A2 2 0 0 0 11.5 2.5H4a1.5 1.5 0 0 0-1.5 1.5v7.5c0 .4.16.78.44 1.06l8.5 8.5a2 2 0 0 0 2.83 0l7.13-7.13a2 2 0 0 0 0-2.83ZM7 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoOrdenar() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M8 4 4 8h3v8H4l4 4 4-4H9V8h3L8 4Zm8 0v2h4V4h-4Zm0 6v2h4v-2h-4Zm0 6v2h4v-2h-4Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoChevronIzquierda() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M15.4 16.6 10.8 12l4.6-4.6L14 6l-6 6 6 6 1.4-1.4Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoTermometro() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M15 13V5a3 3 0 0 0-6 0v8a5 5 0 1 0 6 0Zm-3-10a1 1 0 0 1 1 1v4h-2V4a1 1 0 0 1 1-1Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoGota() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoWifi() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M12 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-4.95-3.05 1.41 1.41a5 5 0 0 1 7.08 0l1.41-1.41a7 7 0 0 0-9.9 0ZM4.22 12.12l1.42 1.42a9 9 0 0 1 12.72 0l1.42-1.42a11 11 0 0 0-15.56 0Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoEscudo() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M12 2 4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3Zm0 2.18 6 2.25v4.66c0 4.14-2.67 7.97-6 9.04-3.33-1.07-6-4.9-6-9.04V6.43l6-2.25Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoEditar() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="m18.988 2.012 3 3L19.7 7.3 16.7 4.3l2.288-2.288Zm-3.7 3.7-11 11V19.7h2.988l11-11-2.988-2.988Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoBasura() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoCamara() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9Zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoLlave() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M7 14A5 5 0 1 1 12 9c0 .4-.05.78-.14 1.15L20 18.3V21h-2.7v-2.7h-2.7V15.6l-2.45-2.45c-.37.09-.75.14-1.15.14A5 5 0 0 1 7 14Zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoCalendario() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2Zm0 16H5V9h14v11ZM7 11h5v5H7v-5Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoDispositivo() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M17 1.01 7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99ZM17 19H7V5h10v14Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoMonitor() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M20 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6v2H8v2h8v-2h-2v-2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 12H4V5h16v10Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoInfo() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoFlechaDerecha() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path
        d="m12 4-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"
        fill="currentColor"
      />
    </svg>
  )
}

export function IconoPlus() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor" />
    </svg>
  )
}

export function IconoCruz() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="currentColor" />
    </svg>
  )
}

export function IconoAjustes() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor" />
    </svg>
  )
}

export function IconoBloqueo() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z" fill="currentColor" />
    </svg>
  )
}

export function IconoGaleria() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor" />
    </svg>
  )
}

export function IconoLapiz() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor" />
    </svg>
  )
}

export function IconoUsuarios() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor" />
    </svg>
  )
}

export function IconoExclamacion() {
  return (
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor" />
    </svg>
  )
}


