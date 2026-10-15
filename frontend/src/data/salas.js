const base = import.meta.env.BASE_URL || '/'

const imagen = (archivo) =>
  `${base.replace(/\/$/, '')}/images/${archivo}`

export const salas = [
  {
    id: 1,
    nombre: 'Sala 1',
    titulo: 'Pintura histórica',
    etiquetaSala: 'SALA 1',
    etiquetaTitulo: 'PINTURA HISTÓRICA',
    imagen: imagen('sala-1-pintura.png'),
    descripcion:
      'Recorre lienzos, retratos y escenas que narran episodios decisivos de nuestra historia, con obras de distintas épocas y escuelas.',
  },
  {
    id: 2,
    nombre: 'Sala 2',
    titulo: 'Cerámica y artesanía',
    etiquetaSala: 'SALA 2',
    etiquetaTitulo: 'CERÁMICA Y ARTESANÍA',
    imagen: imagen('sala-2-ceramica.png'),
    descripcion:
      'Una colección de piezas de barro, porcelana y oficios tradicionales que muestran la creatividad y la técnica de nuestros artesanos.',
  },
  {
    id: 3,
    nombre: 'Sala 3',
    titulo: 'Patrimonio cultural',
    etiquetaSala: 'SALA 3',
    etiquetaTitulo: 'PATRIMONIO CULTURAL',
    imagen: imagen('sala-3-patrimonio.png'),
    descripcion:
      'Máscaras, esculturas y objetos rituales que conservan la memoria y las tradiciones vivas de distintas culturas.',
  },
  {
    id: 4,
    nombre: 'Sala 4',
    titulo: 'Historia natural',
    etiquetaSala: 'SALA 4',
    etiquetaTitulo: 'HISTORIA NATURAL',
    imagen: imagen('sala-4-historia-natural.png'),
    descripcion:
      'Fósiles, esqueletos y especímenes que revelan la evolución de la vida en la Tierra a lo largo de millones de años.',
  },
]

export const heroImagen = imagen('museo-hero.png')
