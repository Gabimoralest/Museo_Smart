-- ============================================================
-- Museo Smart - V5
-- Datos iniciales reproducibles: 4 salas y 8 exhibiciones provisionales.
-- No se inventan autores, fechas, materiales ni contexto historico.
-- Los registros provisionales se identifican con el prefijo [PROVISIONAL].
-- ============================================================

INSERT INTO sala (nombre, descripcion, estado, orden) VALUES
    ('Pintura histórica',   'Sala dedicada a la pintura histórica.',   'activa', 1),
    ('Cerámica y artesanía','Sala dedicada a la cerámica y artesanía.', 'activa', 2),
    ('Patrimonio cultural', 'Sala dedicada al patrimonio cultural.',    'activa', 3),
    ('Historia natural',    'Sala dedicada a la historia natural.',     'activa', 4);

-- Dos exhibiciones provisionales por sala. codigo estable y unico; el resto de
-- campos historicos quedan NULL a proposito.
INSERT INTO exhibicion (sala_id, codigo, titulo, descripcion, activa)
SELECT s.id, v.codigo, v.titulo, v.descripcion, true
FROM (VALUES
    ('Pintura histórica',    'pintura-historica-01',   '[PROVISIONAL] Exhibición 1 - Pintura histórica',   'Registro provisional pendiente de contenido real.'),
    ('Pintura histórica',    'pintura-historica-02',   '[PROVISIONAL] Exhibición 2 - Pintura histórica',   'Registro provisional pendiente de contenido real.'),
    ('Cerámica y artesanía', 'ceramica-artesania-01',  '[PROVISIONAL] Exhibición 1 - Cerámica y artesanía','Registro provisional pendiente de contenido real.'),
    ('Cerámica y artesanía', 'ceramica-artesania-02',  '[PROVISIONAL] Exhibición 2 - Cerámica y artesanía','Registro provisional pendiente de contenido real.'),
    ('Patrimonio cultural',  'patrimonio-cultural-01', '[PROVISIONAL] Exhibición 1 - Patrimonio cultural', 'Registro provisional pendiente de contenido real.'),
    ('Patrimonio cultural',  'patrimonio-cultural-02', '[PROVISIONAL] Exhibición 2 - Patrimonio cultural', 'Registro provisional pendiente de contenido real.'),
    ('Historia natural',     'historia-natural-01',    '[PROVISIONAL] Exhibición 1 - Historia natural',    'Registro provisional pendiente de contenido real.'),
    ('Historia natural',     'historia-natural-02',    '[PROVISIONAL] Exhibición 2 - Historia natural',    'Registro provisional pendiente de contenido real.')
) AS v(sala_nombre, codigo, titulo, descripcion)
JOIN sala s ON s.nombre = v.sala_nombre;

-- Nota: el SuperAdmin inicial NO se inserta aqui. Debe crearse en una fase de
-- configuracion segura, nunca con contrasenas/tokens embebidos en migraciones.
