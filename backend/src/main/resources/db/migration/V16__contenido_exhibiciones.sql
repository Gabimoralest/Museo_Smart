-- ============================================================
-- Museo Smart - V16
-- Contenido definitivo de las 13 exhibiciones.
--
-- Solo SQL. No crea ni modifica esquema, no toca titulo, codigo, sala,
-- ubicacion_3d_id, activa ni multimedia.
--
-- Mapeo de campos (columnas reales de exhibicion, ver V1 y V15):
--   Descripcion corta      -> descripcion_corta   varchar(200)
--   Descripcion completa   -> descripcion         text
--   Epoca                  -> periodo             varchar(150)
--   Materiales             -> material            varchar(200)
--   Cultura o procedencia  -> autor_cultura       varchar(200)
--   Dato curioso           -> dato_curioso        text
--
-- Reglas:
--   - Se resuelve SIEMPRE por codigo (nunca por id).
--   - Solo se actualizan las exhibiciones que aun NO tienen descripcion_corta
--     (WHERE descripcion_corta IS NULL): no se pisa lo ya editado en el panel.
--   - En cada fila actualizada: version = version + 1 y actualizado_en = now().
--   - Textos con dollar quoting ($t$...$t$) por comillas y tildes.
--   - Bloque final DO $$: las 13 exhibiciones existen y todas tienen
--     descripcion_corta no nula.
--
-- ADITIVA: no modifica V1-V15.
-- ============================================================

UPDATE exhibicion AS e
SET descripcion_corta = v.descripcion_corta,
    descripcion       = v.descripcion,
    periodo           = v.periodo,
    material          = v.material,
    autor_cultura     = v.autor_cultura,
    dato_curioso      = v.dato_curioso,
    version           = e.version + 1,
    actualizado_en    = now()
FROM (VALUES
    ('pintura-historica-01',
     $t$Óleo monumental de Emanuel Leutze que recrea el cruce del río Delaware por George Washington en la noche del 25 de diciembre de 1776.$t$,
     $t$Pintada en 1851 en Düsseldorf, la obra muestra a Washington de pie en una barca que avanza entre bloques de hielo, rodeado de soldados de distintos orígenes. El cruce precedió al ataque sorpresa en Trenton, una victoria que levantó la moral del Ejército Continental durante la guerra de independencia de Estados Unidos. El original mide cerca de 3,8 por 6,5 metros y se conserva en el Metropolitan Museum of Art de Nueva York.$t$,
     $t$1851, Romanticismo (escena de 1776)$t$,
     $t$Óleo sobre lienzo$t$,
     $t$Emanuel Leutze; Estados Unidos y Alemania (Escuela de Düsseldorf)$t$,
     $t$La bandera de barras y estrellas que aparece en la barca no existía aún en 1776: fue adoptada en junio de 1777.$t$),

    ('pintura-historica-02',
     $t$Paisaje romántico que captura la luz dorada del atardecer sobre un valle con un río, árboles y montañas lejanas.$t$,
     $t$La obra representa el paisajismo del siglo XIX, cuando los pintores románticos convirtieron la naturaleza en protagonista y buscaron transmitir emociones a través de la luz y la atmósfera. El cielo encendido y la pequeña escala de las figuras humanas invitan a contemplar la grandeza del entorno natural.$t$,
     $t$Siglo XIX$t$,
     $t$Óleo sobre lienzo$t$,
     $t$Escuela romántica europea$t$,
     $t$Muchos paisajistas del siglo XIX tomaban bocetos al aire libre, pero terminaban el cuadro en el taller, combinando elementos de varios lugares en un solo paisaje.$t$),

    ('ceramica-artesania-01',
     $t$Jarrón de porcelana china con la característica silueta abalaustrada: cuello estrecho, hombros anchos y base esbelta.$t$,
     $t$La forma baluster, inspirada en los balaustres de las barandillas, fue muy popular en la porcelana china de la dinastía Qing. Estas piezas, decoradas en azul cobalto bajo cubierta, se producían en los hornos de Jingdezhen y se exportaban en grandes cantidades a Europa, donde adornaban palacios y residencias aristocráticas.$t$,
     $t$Dinastía Qing, siglos XVII y XVIII$t$,
     $t$Porcelana con decoración en azul bajo cubierta$t$,
     $t$China (Jingdezhen)$t$,
     $t$Jingdezhen ha producido porcelana durante más de mil años y se la conoce como la capital de la porcelana de China.$t$),

    ('ceramica-artesania-02',
     $t$Incensario de bronce usado en templos, altares y estudios para quemar resinas y maderas aromáticas.$t$,
     $t$En China, los incensarios formaban parte de los altares domésticos, los templos y los estudios de los eruditos. El humo perfumado acompañaba la oración, la meditación y las ofrendas a los antepasados. Los modelos de bronce con patas y asas, inspirados en antiguas vasijas rituales, fueron muy apreciados durante las dinastías Ming y Qing.$t$,
     $t$Dinastía Ming, siglos XV a XVII$t$,
     $t$Bronce fundido$t$,
     $t$China$t$,
     $t$Los incensarios con la marca del emperador Xuande (1426-1435) fueron tan admirados que se copiaron durante siglos; muchas piezas con esa marca son posteriores.$t$),

    ('patrimonio-cultural-01',
     $t$Vasija ritual de bronce con forma de elefante, usada en la antigua China para servir vino en ceremonias dedicadas a los ancestros.$t$,
     $t$Los zun eran recipientes para el vino ceremonial. Este ejemplar adopta la figura de un elefante cuya trompa servía de vertedor, y su superficie está cubierta de motivos animales y del rostro taotie, típicos de los bronces de finales de la dinastía Shang. Su forma demuestra que en esa época había elefantes en el sur de China.$t$,
     $t$Finales de la dinastía Shang, siglos XIII a XI a. C.$t$,
     $t$Bronce$t$,
     $t$China, dinastía Shang$t$,
     $t$Uno de los ejemplares más famosos fue hallado en 1975 por un campesino en Liling, provincia de Hunan, y hoy se conserva en el Museo de Hunan.$t$),

    ('patrimonio-cultural-02',
     $t$Figura de bronce de un gato sentado, animal sagrado asociado a la diosa Bastet en el antiguo Egipto.$t$,
     $t$Los egipcios veneraban a los gatos como protectores del hogar y símbolos de la diosa Bastet, relacionada con la fertilidad y la protección. Estas estatuillas se ofrecían en santuarios como el de Bubastis, y algunas guardaban en su interior momias de gatos. Suelen mostrar al animal erguido y elegante, a veces con aretes o collares de adorno.$t$,
     $t$Periodo Tardío, c. 664-332 a. C.$t$,
     $t$Bronce, a veces con incrustaciones de oro o plata$t$,
     $t$Antiguo Egipto$t$,
     $t$Según el historiador griego Heródoto, cuando moría el gato de una casa, la familia se afeitaba las cejas en señal de luto.$t$),

    ('historia-natural-01',
     $t$Dinosaurio herbívoro de tres cuernos y gran gola ósea que vivió en Norteamérica al final del período Cretácico.$t$,
     $t$Triceratops medía cerca de 9 metros de largo y podía superar las 6 toneladas. Su cráneo, uno de los más grandes entre los animales terrestres, tenía dos cuernos largos sobre los ojos, uno corto sobre el hocico y una gola que pudo servir para la defensa y la exhibición. Convivió con el Tyrannosaurus rex y fue de los últimos dinosaurios antes de la extinción masiva.$t$,
     $t$Cretácico superior, hace unos 68 a 66 millones de años$t$,
     $t$Fósil (hueso mineralizado)$t$,
     $t$Formación Hell Creek, Norteamérica (actuales Montana y Dakota)$t$,
     $t$Su nombre significa «cara con tres cuernos». Los primeros cuernos hallados se atribuyeron por error a un bisonte gigante.$t$),

    ('historia-natural-02',
     $t$Diente fosilizado del megalodón, el tiburón más grande que ha existido, que dominó los océanos durante millones de años.$t$,
     $t$Otodus megalodon pudo alcanzar entre 15 y 20 metros de longitud. Como su esqueleto era de cartílago, casi solo se conservan sus dientes, que podían superar los 17 centímetros. A partir de ellos los científicos estiman su tamaño y su dieta, que incluía ballenas y otros grandes mamíferos marinos.$t$,
     $t$Mioceno a Plioceno, hace unos 23 a 3,6 millones de años$t$,
     $t$Fósil (diente mineralizado)$t$,
     $t$Océanos de todo el mundo$t$,
     $t$Un tiburón pierde y reemplaza miles de dientes a lo largo de su vida; por eso los dientes fósiles de megalodón son relativamente comunes.$t$),

    ('escultura-retratos-01',
     $t$Busto de mármol que representa a Poncio Pilato, prefecto romano de Judea conocido por su papel en el juicio de Jesús.$t$,
     $t$Poncio Pilato gobernó la provincia romana de Judea entre los años 26 y 36 d. C., bajo el emperador Tiberio. No se conserva ningún retrato auténtico suyo, así que este busto es una interpretación al estilo de los retratos romanos de la época, que buscaban transmitir dignidad y autoridad. Su figura aparece en los evangelios y en los escritos de Flavio Josefo y Filón de Alejandría.$t$,
     $t$Siglo I d. C.$t$,
     $t$Mármol$t$,
     $t$Imperio romano$t$,
     $t$La «Piedra de Pilato», hallada en 1961 en Cesarea Marítima, es la única inscripción de su época que menciona su nombre y su cargo.$t$),

    ('escultura-retratos-02',
     $t$Escultura en mármol de una cabeza de león, símbolo de fuerza y protección en el arte grecorromano.$t$,
     $t$Las cabezas de león eran frecuentes en templos, fuentes y sarcófagos del mundo griego y romano. Además de su valor decorativo, se les atribuía una función protectora frente al mal. En muchos templos servían como gárgolas: el agua de lluvia salía por la boca abierta del animal.$t$,
     $t$Siglos I a. C. a II d. C.$t$,
     $t$Mármol$t$,
     $t$Mundo grecorromano$t$,
     $t$En la Antigüedad había leones salvajes en los Balcanes: Heródoto cuenta que atacaron a los camellos del ejército persa de Jerjes en Macedonia.$t$),

    ('civilizaciones-antiguas-01',
     $t$Estatua sedente del faraón Kefrén, constructor de la segunda pirámide de Guiza, protegido por el dios halcón Horus.$t$,
     $t$Kefrén reinó durante la IV dinastía del Imperio Antiguo y mandó construir la segunda pirámide de Guiza; tradicionalmente también se le atribuye la Gran Esfinge. La estatua lo muestra sentado en un trono adornado con el símbolo de la unión del Alto y el Bajo Egipto, con el halcón Horus abrazando su nuca con las alas. Fue hallada en 1860 en su templo del valle, en Guiza, y se conserva en El Cairo.$t$,
     $t$Imperio Antiguo, IV dinastía, c. 2570 a. C.$t$,
     $t$Gneis anortosítico (piedra dura, a menudo llamada diorita)$t$,
     $t$Antiguo Egipto$t$,
     $t$La piedra de la estatua se trajo desde canteras de la lejana Nubia, en el extremo sur de Egipto, a cientos de kilómetros de Guiza.$t$),

    ('civilizaciones-antiguas-02',
     $t$Estatua colosal de Ramsés II, uno de los faraones más poderosos de Egipto, que gobernó durante 66 años.$t$,
     $t$Ramsés II reinó aproximadamente entre 1279 y 1213 a. C., durante la XIX dinastía del Imperio Nuevo. Impulsó grandes obras como los templos de Abu Simbel y el Ramesseum, y llenó Egipto de estatuas que proclamaban su poder. Es recordado también por la batalla de Qadesh contra los hititas y por uno de los primeros tratados de paz conocidos.$t$,
     $t$Imperio Nuevo, XIX dinastía, siglo XIII a. C.$t$,
     $t$Granito$t$,
     $t$Antiguo Egipto$t$,
     $t$Tuvo más de cien hijos e hijas y sobrevivió a muchos de sus herederos: lo sucedió Merenptah, su decimotercer hijo.$t$),

    ('plaza-central-01',
     $t$Escultura en piedra de estilo gótico que preside la plaza central del museo y da la bienvenida a los visitantes.$t$,
     $t$El arte gótico surgió en Francia en el siglo XII y se extendió por Europa. Las esculturas de este periodo adornaban las portadas y fachadas de las catedrales, y dejaron atrás la rigidez del románico para mostrar figuras más naturales, con ropajes de pliegues profundos, gestos expresivos y una suave curva en el cuerpo. Servían para enseñar historias religiosas a una población que en su mayoría no sabía leer.$t$,
     $t$Siglos XII a XV$t$,
     $t$Piedra caliza$t$,
     $t$Europa occidental (Francia)$t$,
     $t$Muchas esculturas góticas estaban pintadas con colores vivos; con los siglos la pintura se perdió y hoy las vemos del color de la piedra.$t$)
) AS v(codigo, descripcion_corta, descripcion, periodo, material, autor_cultura, dato_curioso)
WHERE e.codigo = v.codigo
  AND e.descripcion_corta IS NULL;

-- ------------------------------------------------------------
-- Verificacion final: las 13 exhibiciones existen y TODAS tienen
-- descripcion_corta no nula.
-- ------------------------------------------------------------
DO $$
DECLARE
    v_faltantes text;
    v_sin_corta text;
    v_total     integer;
BEGIN
    SELECT string_agg(exp.codigo, ', ' ORDER BY exp.codigo)
      INTO v_faltantes
    FROM (VALUES
        ('pintura-historica-01'),
        ('pintura-historica-02'),
        ('ceramica-artesania-01'),
        ('ceramica-artesania-02'),
        ('patrimonio-cultural-01'),
        ('patrimonio-cultural-02'),
        ('historia-natural-01'),
        ('historia-natural-02'),
        ('escultura-retratos-01'),
        ('escultura-retratos-02'),
        ('civilizaciones-antiguas-01'),
        ('civilizaciones-antiguas-02'),
        ('plaza-central-01')
    ) AS exp(codigo)
    WHERE NOT EXISTS (SELECT 1 FROM exhibicion e WHERE e.codigo = exp.codigo);

    IF v_faltantes IS NOT NULL THEN
        RAISE EXCEPTION 'V16: faltan exhibiciones requeridas por codigo: %', v_faltantes;
    END IF;

    SELECT string_agg(e.codigo, ', ' ORDER BY e.codigo)
      INTO v_sin_corta
    FROM exhibicion e
    WHERE e.descripcion_corta IS NULL;

    IF v_sin_corta IS NOT NULL THEN
        RAISE EXCEPTION 'V16: exhibiciones sin descripcion_corta: %', v_sin_corta;
    END IF;

    SELECT count(*) INTO v_total FROM exhibicion;
    IF v_total <> 13 THEN
        RAISE EXCEPTION 'V16: se esperaban 13 exhibiciones, hay %', v_total;
    END IF;
END $$;
