-- ============================================================
-- Museo Smart - V13
-- Contenido y sensores de las salas 5 y 6 (4 exhibiciones nuevas).
--
-- Crea 4 exhibiciones [PROVISIONAL], las asocia a su ubicacion_3d y
-- marca esa ubicacion como OCUPADA. Luego:
--   - Copia el criterio de limites ambientales de V9 (COALESCE, nunca
--     sobrescribe valores ya configurados).
--   - Crea 2 sensores ambientales (salas 5 y 6) y 4 de presencia (uno por
--     exhibicion nueva), siguiendo el patron de codigos de V8 y respetando
--     los CHECK de V7 (AMBIENTAL->MULTI con sala_id; PRESENCIA->PRESENCIA
--     con exhibicion_id).
--
-- Todo se resuelve por codigo (exhibicion.codigo, sala.codigo_3d,
-- ubicacion_3d.codigo), nunca por id numerico.
--
-- ADITIVA e IDEMPOTENTE (ON CONFLICT / NOT EXISTS): reejecutar no duplica
-- ni sobrescribe. No modifica V1-V12.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Asegurar que las salas 5 y 6 y sus ubicaciones existen (guardia).
-- ------------------------------------------------------------
DO $$
DECLARE
    v_faltantes text;
BEGIN
    SELECT string_agg(exp.codigo, ', ')
      INTO v_faltantes
    FROM (VALUES ('SALA_5'), ('SALA_6')) AS exp(codigo)
    WHERE NOT EXISTS (SELECT 1 FROM sala s WHERE s.codigo_3d = exp.codigo);

    IF v_faltantes IS NOT NULL THEN
        RAISE EXCEPTION 'V13: faltan salas requeridas (por codigo_3d): %', v_faltantes;
    END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Insertar las 4 exhibiciones nuevas [PROVISIONAL].
--
--    IMPORTANTE (separacion de identificadores):
--      - exhibicion.codigo  = identificador de CONTENIDO, patron de V5
--        (escultura-retratos-01, civilizaciones-antiguas-01, ...).
--      - ubicacion_3d.codigo = identificador del NODO del GLB
--        (EXH_S5_01, EXH_S6_02, ...). Es lo que consume el visor 3D.
--    Se relacionan por la columna ubicacion_3d_id, nunca por coincidencia
--    de codigo.
--
--    sala_id resuelto por sala.codigo_3d; ubicacion_3d_id por codigo.
--    El trigger de V12 valida que la ubicacion sea de la MISMA sala y la
--    marca OCUPADA.
-- ------------------------------------------------------------
INSERT INTO exhibicion (sala_id, codigo, titulo, descripcion, activa, ubicacion_3d_id)
SELECT s.id,
       v.codigo,
       v.titulo,
       v.descripcion,
       true,
       u.id
FROM (VALUES
    ('SALA_5', 'escultura-retratos-01',      '[PROVISIONAL] Busto de Pilato',      'Registro provisional pendiente de contenido real.', 'EXH_S5_01'),
    ('SALA_5', 'escultura-retratos-02',      '[PROVISIONAL] Cabeza de león',       'Registro provisional pendiente de contenido real.', 'EXH_S5_02'),
    ('SALA_6', 'civilizaciones-antiguas-01', '[PROVISIONAL] Estatua de Kefrén',    'Registro provisional pendiente de contenido real.', 'EXH_S6_01'),
    ('SALA_6', 'civilizaciones-antiguas-02', '[PROVISIONAL] Estatua de Ramsés II', 'Registro provisional pendiente de contenido real.', 'EXH_S6_02')
) AS v(sala_codigo, codigo, titulo, descripcion, ubicacion_codigo)
JOIN sala s       ON s.codigo_3d = v.sala_codigo
JOIN ubicacion_3d u ON u.codigo = v.ubicacion_codigo
WHERE NOT EXISTS (SELECT 1 FROM exhibicion e WHERE e.codigo = v.codigo);

-- ------------------------------------------------------------
-- 3. Limites ambientales de las 4 exhibiciones nuevas (mismo criterio
--    de conservacion que V9). COALESCE: solo completa NULL.
--      Escultura y retratos     -> T 18-24 C, HR 40-60 %, luz <= 200 lx
--      Civilizaciones antiguas  -> T 18-24 C, HR 40-60 %, luz <= 200 lx
-- ------------------------------------------------------------
UPDATE exhibicion e
SET temp_min_c      = COALESCE(e.temp_min_c,      v.temp_min_c),
    temp_max_c      = COALESCE(e.temp_max_c,      v.temp_max_c),
    humedad_min_pct = COALESCE(e.humedad_min_pct, v.humedad_min_pct),
    humedad_max_pct = COALESCE(e.humedad_max_pct, v.humedad_max_pct),
    luz_max_lux     = COALESCE(e.luz_max_lux,     v.luz_max_lux)
FROM (VALUES
    ('escultura-retratos-01',      18.00, 24.00, 40.00, 60.00, 200.00),
    ('escultura-retratos-02',      18.00, 24.00, 40.00, 60.00, 200.00),
    ('civilizaciones-antiguas-01', 18.00, 24.00, 40.00, 60.00, 200.00),
    ('civilizaciones-antiguas-02', 18.00, 24.00, 40.00, 60.00, 200.00)
) AS v(exhibicion_codigo, temp_min_c, temp_max_c, humedad_min_pct, humedad_max_pct, luz_max_lux)
WHERE e.codigo = v.exhibicion_codigo;

-- ------------------------------------------------------------
-- 4. Sensores.
--    Ambientales: SENSOR-AMBIENTAL-005 (sala 5), -006 (sala 6).
--    Presencia:   SENSOR-PRESENCIA-009..012, uno por exhibicion nueva.
--    Idempotente por sensor.codigo (uq_sensor_codigo).
-- ------------------------------------------------------------
INSERT INTO sensor (codigo, tipo, categoria, sala_id, exhibicion_id, descripcion, estado)
SELECT 'SENSOR-AMBIENTAL-005', 'MULTI', 'AMBIENTAL',
       (SELECT id FROM sala WHERE codigo_3d = 'SALA_5'), NULL,
       'Sensor ambiental (temperatura, humedad y luminosidad) de la sala Escultura y retratos.', 'ACTIVO'
WHERE NOT EXISTS (SELECT 1 FROM sensor WHERE codigo = 'SENSOR-AMBIENTAL-005');

INSERT INTO sensor (codigo, tipo, categoria, sala_id, exhibicion_id, descripcion, estado)
SELECT 'SENSOR-AMBIENTAL-006', 'MULTI', 'AMBIENTAL',
       (SELECT id FROM sala WHERE codigo_3d = 'SALA_6'), NULL,
       'Sensor ambiental (temperatura, humedad y luminosidad) de la sala Civilizaciones antiguas.', 'ACTIVO'
WHERE NOT EXISTS (SELECT 1 FROM sensor WHERE codigo = 'SENSOR-AMBIENTAL-006');

INSERT INTO sensor (codigo, tipo, categoria, sala_id, exhibicion_id, descripcion, estado)
SELECT v.sensor_codigo, 'PRESENCIA', 'PRESENCIA', NULL,
       (SELECT id FROM exhibicion WHERE codigo = v.exhibicion_codigo),
       v.descripcion, 'ACTIVO'
FROM (VALUES
    ('SENSOR-PRESENCIA-009', 'escultura-retratos-01',      'Sensor de presencia de la exhibición escultura-retratos-01 (Busto de Pilato).'),
    ('SENSOR-PRESENCIA-010', 'escultura-retratos-02',      'Sensor de presencia de la exhibición escultura-retratos-02 (Cabeza de león).'),
    ('SENSOR-PRESENCIA-011', 'civilizaciones-antiguas-01', 'Sensor de presencia de la exhibición civilizaciones-antiguas-01 (Estatua de Kefrén).'),
    ('SENSOR-PRESENCIA-012', 'civilizaciones-antiguas-02', 'Sensor de presencia de la exhibición civilizaciones-antiguas-02 (Estatua de Ramsés II).')
) AS v(sensor_codigo, exhibicion_codigo, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM sensor s WHERE s.codigo = v.sensor_codigo);

-- ------------------------------------------------------------
-- 5. Verificacion final (criterio de V8:107): aborta si el estado global
--    no es exactamente 6 salas / 12 exhibiciones / 12 ubicaciones OCUPADA
--    / 6 sensores ambientales / 12 de presencia.
-- ------------------------------------------------------------
DO $$
DECLARE
    v_salas        integer;
    v_exhibiciones integer;
    v_ocupadas     integer;
    v_ambientales  integer;
    v_presencias   integer;
    v_problemas    text;
BEGIN
    SELECT count(*) INTO v_salas        FROM sala;
    SELECT count(*) INTO v_exhibiciones FROM exhibicion;
    SELECT count(*) INTO v_ocupadas     FROM ubicacion_3d WHERE estado = 'OCUPADA';
    SELECT count(*) INTO v_ambientales  FROM sensor WHERE categoria = 'AMBIENTAL';
    SELECT count(*) INTO v_presencias   FROM sensor WHERE categoria = 'PRESENCIA';

    IF v_salas <> 6 THEN
        RAISE EXCEPTION 'V13: se esperaban 6 salas, hay %', v_salas;
    END IF;
    IF v_exhibiciones <> 12 THEN
        RAISE EXCEPTION 'V13: se esperaban 12 exhibiciones, hay %', v_exhibiciones;
    END IF;
    IF v_ocupadas <> 12 THEN
        RAISE EXCEPTION 'V13: se esperaban 12 ubicaciones OCUPADA, hay %', v_ocupadas;
    END IF;
    IF v_ambientales <> 6 THEN
        RAISE EXCEPTION 'V13: se esperaban 6 sensores ambientales, hay %', v_ambientales;
    END IF;
    IF v_presencias <> 12 THEN
        RAISE EXCEPTION 'V13: se esperaban 12 sensores de presencia, hay %', v_presencias;
    END IF;

    -- Cada exhibicion debe tener exactamente una ubicacion de su misma sala.
    SELECT string_agg(e.codigo, ', ' ORDER BY e.codigo)
      INTO v_problemas
    FROM exhibicion e
    LEFT JOIN ubicacion_3d u ON u.id = e.ubicacion_3d_id
    WHERE u.id IS NULL OR u.sala_id IS DISTINCT FROM e.sala_id;

    IF v_problemas IS NOT NULL THEN
        RAISE EXCEPTION 'V13: exhibiciones sin ubicacion o con ubicacion de otra sala: %', v_problemas;
    END IF;

    -- Una ubicacion OCUPADA debe tener exhibicion, y una DISPONIBLE no.
    SELECT string_agg(u.codigo, ', ' ORDER BY u.codigo)
      INTO v_problemas
    FROM ubicacion_3d u
    LEFT JOIN exhibicion e ON e.ubicacion_3d_id = u.id
    WHERE (u.estado = 'OCUPADA' AND e.id IS NULL)
       OR (u.estado = 'DISPONIBLE' AND e.id IS NOT NULL);

    IF v_problemas IS NOT NULL THEN
        RAISE EXCEPTION 'V13: estado de ubicacion incoherente con su exhibicion: %', v_problemas;
    END IF;
END $$;
