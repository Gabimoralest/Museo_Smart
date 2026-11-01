// ============================================================
// API de exhibiciones (administración) — Museo Smart
// ------------------------------------------------------------
// Sobre el cliente administrativo común (adminApi.js → httpClient.js).
//
// Endpoints reales del backend (ver ExhibicionAdminController):
//   GET    /api/v1/admin/exhibiciones                 -> ExhibicionAdminResponse[]
//   GET    /api/v1/admin/exhibiciones/{id}            -> ExhibicionAdminResponse
//   PUT    /api/v1/admin/exhibiciones/{id}            -> ExhibicionAdminResponse
//   PATCH  /api/v1/admin/exhibiciones/{id}/estado     -> ExhibicionAdminResponse
//   PUT    /api/v1/admin/exhibiciones/{id}/imagen     (multipart 'archivo')
//   PUT    /api/v1/admin/exhibiciones/{id}/video      (multipart 'archivo')
//   DELETE /api/v1/admin/exhibiciones/{id}/video      -> 204
//   DELETE /api/v1/admin/exhibiciones/{id}/imagen     -> 409 (no permitido)
//   GET    /api/v1/admin/exhibiciones/{id}/historial  -> ExhibicionHistorialItem[]
//
// Requieren rol ADMIN o SUPERADMIN (Spring Security).
// ============================================================
import { solicitarAdmin } from './adminApi'
import { obtenerToken } from './sessionService'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

/** Lista todas las exhibiciones (incluidas inactivas y la especial). */
export function listarExhibiciones({ signal } = {}) {
  return solicitarAdmin('/admin/exhibiciones', { method: 'GET', signal })
}

/** Detalle completo de una exhibición. */
export function obtenerExhibicion(id, { signal } = {}) {
  return solicitarAdmin(`/admin/exhibiciones/${id}`, { method: 'GET', signal })
}

/**
 * Edita el contenido. `version` es la versión leída: si otra persona editó
 * mientras tanto, el backend responde 409.
 */
export function editarExhibicion(id, datos, { signal } = {}) {
  return solicitarAdmin(`/admin/exhibiciones/${id}`, {
    method: 'PUT',
    datos,
    signal,
  })
}

/** Activa o desactiva una exhibición. */
export function cambiarEstadoExhibicion(id, activa, motivo, { signal } = {}) {
  return solicitarAdmin(`/admin/exhibiciones/${id}/estado`, {
    method: 'PATCH',
    datos: { activa, ...(motivo ? { motivo } : {}) },
    signal,
  })
}

/**
 * Sube o reemplaza un archivo multimedia (imagen o video).
 * Usa XMLHttpRequest cuando hay onProgress para notificar avance real en la subida,
 * o fetch como alternativa. Mantiene el Bearer del sessionService.
 */
async function subirArchivo(id, recurso, archivo, { signal, onProgress } = {}) {
  const token = obtenerToken()
  const formulario = new FormData()
  formulario.append('archivo', archivo)

  if (typeof XMLHttpRequest !== 'undefined' && onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', `${API_BASE}/admin/exhibiciones/${id}/${recurso}`)
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      if (signal) {
        signal.addEventListener('abort', () => xhr.abort())
      }

      xhr.upload.onprogress = (evento) => {
        if (evento.lengthComputable && onProgress) {
          const porcentaje = Math.round((evento.loaded / evento.total) * 100)
          onProgress(porcentaje)
        }
      }

      xhr.onload = () => {
        let cuerpo = null
        try {
          cuerpo = JSON.parse(xhr.responseText)
        } catch {
          cuerpo = null
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100)
          resolve(cuerpo)
        } else {
          const error = new Error(cuerpo?.mensaje || 'No se pudo subir el archivo.')
          error.estado = xhr.status
          error.erroresValidacion = cuerpo?.erroresValidacion ?? null
          reject(error)
        }
      }

      xhr.onerror = () => {
        const error = new Error('No pudimos conectar con el servidor para subir el archivo.')
        error.estado = 0
        reject(error)
      }

      xhr.onabort = () => {
        const error = new Error('Subida cancelada.')
        error.name = 'AbortError'
        reject(error)
      }

      xhr.send(formulario)
    })
  }

  const respuesta = await fetch(`${API_BASE}/admin/exhibiciones/${id}/${recurso}`, {
    method: 'PUT',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formulario,
    signal,
  })

  let cuerpo = null
  try {
    cuerpo = await respuesta.json()
  } catch {
    cuerpo = null
  }

  if (!respuesta.ok) {
    const error = new Error(cuerpo?.mensaje || 'No se pudo subir el archivo.')
    error.estado = respuesta.status
    error.erroresValidacion = cuerpo?.erroresValidacion ?? null
    throw error
  }
  return cuerpo
}

export function subirImagen(id, archivo, opciones = {}) {
  return subirArchivo(id, 'imagen', archivo, opciones)
}

export function subirVideo(id, archivo, opciones = {}) {
  return subirArchivo(id, 'video', archivo, opciones)
}

export function eliminarVideo(id, { signal } = {}) {
  return solicitarAdmin(`/admin/exhibiciones/${id}/video`, { method: 'DELETE', signal })
}

export function historialExhibicion(id, { signal } = {}) {
  return solicitarAdmin(`/admin/exhibiciones/${id}/historial`, { method: 'GET', signal })
}

/** Resuelve una URL de media a absoluta usando la base de la API. */
export function urlMedia(url) {
  if (!url) return null
  if (
    url.startsWith('http://')
    || url.startsWith('https://')
    || url.startsWith('blob:')
    || url.startsWith('data:')
  ) {
    return url
  }
  const ruta = url.startsWith('/') ? url : `/${url}`
  // /media/... vive en la raíz del backend, no bajo /api/v1.
  const base = API_BASE.replace(/\/api\/v1$/, '')
  return `${base}${ruta}`
}

