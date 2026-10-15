const apartados = [
  {
    id: 'historia',
    etiqueta: 'Historia',
    titulo: 'Nuestra historia',
    texto:
      'Museo Smart nació del deseo de reunir en un mismo espacio el arte, la cultura y la naturaleza. Lo que comenzó como una pequeña colección de piezas patrimoniales se transformó con los años en un museo virtual que hoy recorre cuatro salas temáticas abiertas a todo el público.',
  },
  {
    id: 'proposito',
    etiqueta: 'Propósito',
    titulo: 'Nuestro propósito',
    texto:
      'Acercar el conocimiento a toda la comunidad mediante una experiencia inmersiva, accesible y gratuita. Conservamos, estudiamos y difundimos el patrimonio para que cada visitante pueda explorar, aprender y descubrir desde cualquier lugar del mundo.',
  },
  {
    id: 'educativa',
    etiqueta: 'Propuesta educativa',
    titulo: 'Propuesta educativa',
    texto:
      'Diseñamos recorridos guiados y materiales de apoyo para estudiantes, docentes y familias. Cada sala se convierte en un recurso didáctico que invita a observar, preguntar y comprender la riqueza cultural y natural que nos rodea.',
  },
]

export default function AcercaDe() {
  return (
    <section className="acerca" id="acerca">
      <div className="acerca__cabecera">
        <h2 className="acerca__titulo">Acerca de Museo Smart</h2>
        <p className="acerca__subtitulo">
          Un museo virtual que conecta el patrimonio con la experiencia digital.
        </p>
      </div>

      <div className="acerca__grid">
        {apartados.map((apartado) => (
          <article className="acerca__bloque" key={apartado.id} id={apartado.id}>
            <span className="acerca__etiqueta">{apartado.etiqueta}</span>
            <h3 className="acerca__bloque-titulo">{apartado.titulo}</h3>
            <p className="acerca__texto">{apartado.texto}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
