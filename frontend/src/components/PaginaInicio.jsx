import { useEffect, useState } from 'react'
import Hero from './Hero'
import { listarTodasExhibicionesPublicas } from '../data/exhibicionesPublicasApi'
import { urlMedia } from '../data/exhibicionesApi'
import { exhibicionMostrable, primeraVista } from '../data/fichaExhibicion'
import { RUTAS } from '../data/rutas'

// Exhibición especial de la plaza central, tomada de la API pública
// (GET /api/v1/exhibiciones). No se inventan datos: si no existe o falla, se
// muestra un texto neutro.
function useExhibicionEspecial() {
  const [exhibicion, setExhibicion] = useState(null)
  const [estado, setEstado] = useState('cargando')

  useEffect(() => {
    const controlador = new AbortController()

    listarTodasExhibicionesPublicas({ signal: controlador.signal })
      .then((datos) => {
        if (controlador.signal.aborted) return
        const lista = Array.isArray(datos) ? datos : []
        const especial = lista.find((ex) => ex?.especial) || null
        setExhibicion(especial)
        setEstado('listo')
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return
        setExhibicion(null)
        setEstado('error')
      })

    return () => controlador.abort()
  }, [])

  return { exhibicion, estado }
}

function TarjetaDestacada({ exhibicion, estado }) {
  const mostrar = exhibicion && exhibicionMostrable(exhibicion)
  const vista = mostrar ? primeraVista(exhibicion) : null
  const imagen = mostrar && exhibicion.imagenUrl ? urlMedia(exhibicion.imagenUrl) : null

  return (
    <article className="destacado">
      <div className="destacado__media">
        {imagen ? (
          <img className="destacado__imagen" src={imagen} alt="" loading="lazy" />
        ) : (
          <div className="destacado__vacia" aria-hidden="true">
            <span>{mostrar ? vista.titulo : 'Plaza central'}</span>
          </div>
        )}
      </div>
      <div className="destacado__cuerpo">
        <span className="destacado__etiqueta">Exhibición especial · Plaza central</span>
        {estado === 'cargando' && (
          <p className="destacado__texto" role="status">
            Cargando la exhibición…
          </p>
        )}
        {estado === 'error' && (
          <p className="destacado__texto" role="status">
            No pudimos cargar la exhibición especial.
          </p>
        )}
        {estado === 'listo' && mostrar && (
          <>
            <h2 className="destacado__titulo">{vista.titulo}</h2>
            {vista.procedencia && (
              <p className="destacado__procedencia">{vista.procedencia}</p>
            )}
            {vista.descripcionCorta && (
              <p className="destacado__texto">{vista.descripcionCorta}</p>
            )}
          </>
        )}
        {estado === 'listo' && !mostrar && (
          <p className="destacado__texto">
            La exhibición especial de la plaza central no está disponible por el
            momento.
          </p>
        )}
      </div>
    </article>
  )
}

// Página de inicio: portada + resumen con la exhibición especial y dos accesos.
export default function PaginaInicio() {
  const { exhibicion, estado } = useExhibicionEspecial()

  return (
    <>
      <Hero />
      <section className="inicio-resumen" aria-labelledby="inicio-resumen-titulo">
        <div className="inicio-resumen__cabecera">
          <h2 className="inicio-resumen__titulo" id="inicio-resumen-titulo">
            Descubre el museo
          </h2>
          <p className="inicio-resumen__subtitulo">
            Una exhibición especial y dos formas de visitar el museo.
          </p>
        </div>

        <TarjetaDestacada exhibicion={exhibicion} estado={estado} />

        <div className="inicio-resumen__accesos">
          <a className="inicio-resumen__acceso" href={RUTAS.salas}>
            <span className="inicio-resumen__acceso-titulo">Ver las salas</span>
            <span className="inicio-resumen__acceso-texto">
              Conoce las salas del museo y sus exhibiciones.
            </span>
          </a>
          <a className="inicio-resumen__acceso" href={RUTAS.experiencia}>
            <span className="inicio-resumen__acceso-titulo">Vive la experiencia 3D</span>
            <span className="inicio-resumen__acceso-texto">
              Recorre el museo en primera persona.
            </span>
          </a>
        </div>
      </section>
    </>
  )
}
