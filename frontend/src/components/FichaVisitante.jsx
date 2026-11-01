import { useEffect, useRef, useState } from 'react'
import { urlMedia } from '../data/exhibicionesApi'
import { valorReal } from '../data/fichaExhibicion'
import { IconoCerrar } from './iconos'
import './FichaVisitante.css'

/**
 * Ficha del visitante reutilizable (recorrido 3D, ModalSala y vista previa del panel).
 *
 * Requisitos:
 * - Sin botón "Ver más": toda la información visible.
 * - Arriba, carrusel de máx. 2 elementos: imagen (1°) y video (2°).
 *   Si no hay video, solo la imagen, sin flechas ni puntos.
 *   El video no se reproduce solo; se pausa al cambiar de slide o al cerrar.
 * - Debajo: nombre, procedencia · época, sala · categoría, descripción corta,
 *   descripción completa, materiales y dato curioso destacado.
 *   Campos vacíos no se muestran.
 * - Altura máxima con scroll interno si el contenido es largo.
 * - Accesibilidad: flechas con aria-label y soporte de teclado/deslizamiento táctil.
 */
export default function FichaVisitante({
  exhibicion,
  onCerrar,
  modo = 'default',
  errorDatos = false,
  sinDatos = false,
}) {
  const [slide, setSlide] = useState(0) // 0: imagen, 1: video
  const videoRef = useRef(null)
  const touchStartX = useRef(null)

  // Datos limpios de la exhibición
  const titulo = valorReal(exhibicion?.titulo) || 'Obra sin título'
  const cultura = valorReal(exhibicion?.autorCultura || exhibicion?.culturaProcedencia)
  const epoca = valorReal(exhibicion?.periodo)
  const procedenciaLinea = cultura && epoca ? `${cultura} · ${epoca}` : cultura || epoca || null

  const esEspecial = Boolean(
    exhibicion?.especial
    || exhibicion?.codigo === 'plaza-central-01'
    || String(exhibicion?.ubicacion3dCodigo || '').toUpperCase().includes('CENTRO')
  )

  const salaNombre = esEspecial ? 'Plaza central' : valorReal(exhibicion?.salaNombre)
  const categoria = esEspecial ? 'Exhibición especial' : valorReal(exhibicion?.categoria)

  let salaCategoriaLinea = null
  if (esEspecial) {
    salaCategoriaLinea = 'Plaza central · Exhibición especial'
  } else if (salaNombre && categoria) {
    salaCategoriaLinea = `${salaNombre} · ${categoria}`
  } else {
    salaCategoriaLinea = salaNombre || categoria || null
  }

  const descripcionCorta = valorReal(exhibicion?.descripcionCorta)
  const descripcionCompleta = valorReal(exhibicion?.descripcion)
  const materiales = valorReal(exhibicion?.material)
  const datoCurioso = valorReal(exhibicion?.datoCurioso)

  const imagenUrl = exhibicion?.imagenUrl ? urlMedia(exhibicion.imagenUrl) : null
  const videoUrl = exhibicion?.videoUrl ? urlMedia(exhibicion.videoUrl) : null
  const tieneVideo = Boolean(videoUrl)

  // Pausar video si se cambia al slide de imagen o si se desmonta
  useEffect(() => {
    if (slide !== 1 && videoRef.current) {
      videoRef.current.pause()
    }
  }, [slide])

  useEffect(() => {
    const videoEl = videoRef.current
    return () => {
      if (videoEl) {
        videoEl.pause()
      }
    }
  }, [])

  const handleCerrar = () => {
    if (videoRef.current) {
      videoRef.current.pause()
    }
    onCerrar?.()
  }

  const irASlide = (nuevo) => {
    if (!tieneVideo) return
    setSlide(nuevo)
  }

  const anterior = () => {
    if (!tieneVideo) return
    setSlide((s) => (s === 0 ? 1 : 0))
  }

  const siguiente = () => {
    if (!tieneVideo) return
    setSlide((s) => (s === 1 ? 0 : 1))
  }

  // Deslizamiento táctil (swipe)
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e) => {
    if (touchStartX.current == null || !tieneVideo) return
    const diff = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (diff > 45) {
      anterior()
    } else if (diff < -45) {
      siguiente()
    }
  }

  // Navegación con teclado
  const handleKeyDown = (e) => {
    if (!tieneVideo) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      anterior()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      siguiente()
    }
  }

  const modoClase = modo ? `ficha-visitante--${modo}` : ''

  return (
    <article
      className={`ficha-visitante ${modoClase}`}
      role="region"
      aria-label={`Ficha de ${titulo}`}
    >
      {onCerrar && (
        <button
          type="button"
          className="ficha-visitante__cerrar"
          onClick={handleCerrar}
          aria-label="Cerrar ficha de la exhibición"
        >
          <IconoCerrar />
        </button>
      )}

      {/* CARRUSEL DE MEDIOS (máx. 2 elementos: imagen y video) */}
      <div
        className="ficha-visitante__carrusel"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onKeyDown={handleKeyDown}
        tabIndex={tieneVideo ? 0 : -1}
        role="region"
        aria-roledescription={tieneVideo ? 'carrusel' : undefined}
        aria-label="Galería multimedia"
      >
        <div className="ficha-visitante__medios-marco">
          {/* Elemento 0: Imagen */}
          <div
            className={`ficha-visitante__slide ${slide === 0 ? 'is-activo' : ''}`}
            aria-hidden={slide !== 0}
          >
            {imagenUrl ? (
              <img
                className="ficha-visitante__imagen"
                src={imagenUrl}
                alt={titulo}
                loading="lazy"
              />
            ) : (
              <div className="ficha-visitante__placeholder-media">
                <span>Falta imagen</span>
              </div>
            )}
          </div>

          {/* Elemento 1: Video (solo si existe) */}
          {tieneVideo && (
            <div
              className={`ficha-visitante__slide ${slide === 1 ? 'is-activo' : ''}`}
              aria-hidden={slide !== 1}
            >
              <video
                ref={videoRef}
                className="ficha-visitante__video"
                src={videoUrl}
                controls
                preload="metadata"
                playsInline
              />
            </div>
          )}
        </div>

        {/* Controles del carrusel: SOLO si hay video */}
        {tieneVideo && (
          <>
            <button
              type="button"
              className="ficha-visitante__carrusel-btn ficha-visitante__carrusel-btn--prev"
              onClick={anterior}
              aria-label={slide === 0 ? 'Ver video' : 'Ver imagen'}
            >
              ‹
            </button>
            <button
              type="button"
              className="ficha-visitante__carrusel-btn ficha-visitante__carrusel-btn--next"
              onClick={siguiente}
              aria-label={slide === 0 ? 'Ver video' : 'Ver imagen'}
            >
              ›
            </button>

            <div className="ficha-visitante__puntos" role="tablist" aria-label="Seleccionar medio">
              <button
                type="button"
                role="tab"
                className={`ficha-visitante__punto ${slide === 0 ? 'is-activo' : ''}`}
                onClick={() => irASlide(0)}
                aria-selected={slide === 0}
                aria-label="Imagen"
              />
              <button
                type="button"
                role="tab"
                className={`ficha-visitante__punto ${slide === 1 ? 'is-activo' : ''}`}
                onClick={() => irASlide(1)}
                aria-selected={slide === 1}
                aria-label="Video"
              />
            </div>
          </>
        )}
      </div>

      {/* CONTENIDO DE LA FICHA (con scroll interno) */}
      <div className="ficha-visitante__cuerpo">
        {/* Encabezado: Título */}
        <h3 className="ficha-visitante__titulo">{titulo}</h3>

        {/* Cultura o procedencia · Época */}
        {procedenciaLinea && (
          <p className="ficha-visitante__procedencia">{procedenciaLinea}</p>
        )}

        {/* Sala · Categoría */}
        {salaCategoriaLinea && (
          <p className="ficha-visitante__sala-cat">{salaCategoriaLinea}</p>
        )}

        {/* Descripción corta */}
        {descripcionCorta && (
          <p className="ficha-visitante__descripcion-corta">{descripcionCorta}</p>
        )}

        {/* Descripción completa */}
        {descripcionCompleta && (
          <div className="ficha-visitante__seccion-texto">
            <h4 className="ficha-visitante__subtitulo">Descripción completa</h4>
            <p className="ficha-visitante__descripcion-completa">{descripcionCompleta}</p>
          </div>
        )}

        {/* Materiales */}
        {materiales && (
          <div className="ficha-visitante__campo">
            <span className="ficha-visitante__campo-etiqueta">Materiales:</span>
            <span className="ficha-visitante__campo-valor">{materiales}</span>
          </div>
        )}

        {/* Dato curioso en recuadro destacado */}
        {datoCurioso && (
          <div className="ficha-visitante__dato-curioso" role="note">
            <span className="ficha-visitante__dato-curioso-titulo">Dato curioso</span>
            <p className="ficha-visitante__dato-curioso-texto">{datoCurioso}</p>
          </div>
        )}

        {sinDatos && (
          <p className="ficha-visitante__aviso">
            Ficha en preparación: la información de esta obra se irá publicando
            a medida que se confirme su contenido.
          </p>
        )}

        {errorDatos && !sinDatos && (
          <p className="ficha-visitante__aviso ficha-visitante__aviso--error">
            No se pudieron cargar todos los datos de la exhibición.
          </p>
        )}
      </div>
    </article>
  )
}
