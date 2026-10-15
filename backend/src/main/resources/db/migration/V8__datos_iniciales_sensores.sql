-- ============================================================
-- Museo Smart - V8
-- Registro inicial de los 12 sensores simulados por Node-RED.
--
-- Distribucion (coincide con el nodo 'Simulador 12 sensores' del flujo
-- docker/nodered/museo-smart-flows.json):
--   - 4 sensores AMBIENTALES: uno por sala, tipo MULTI.
--   - 8 sensores de PRESENCIA: uno por exhibicion.
--
-- Codigos y ubicaciones tomados del simulador Node-RED, no inventados:
--   SENSOR-AMBIENTAL-001..004 -> salaId 1..4
--   SENSOR-PRESENCIA-001..008 -> exhibicionId 1..8
--
-- Idempotente: INSERT ... ON CONFLICT (codigo) DO NOTHING respeta
-- uq_sensor_codigo; reejecutar no duplica ni sobrescribe nada.
--
-- Restricciones de V7 que se respetan EN EL MISMO INSERT (imprescindible:
-- ck_sensor_ubicacion se evalua al insertar, por lo que la ubicacion no puede
-- quedar NULL de forma transitoria):
--   - ck_sensor_categoria_tipo: AMBIENTAL->MULTI, PRESENCIA->PRESENCIA.
--   - ck_sensor_ubicacion: AMBIENTAL con sala_id y sin exhibicion_id;
--     PRESENCIA con exhibicion_id y sin sala_id.
--
-- Si ya existiera un sensor con el mismo codigo pero categoria, tipo o
-- ubicacion distintos de los esperados, la migracion ABORTA con un error
-- explicito (bloque de verificacion final) en lugar de dejarlo mal asociado.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Requisito previo: las 4 salas deben existir con su nombre real.
--    Si falta alguna, se aborta antes de tocar la tabla sensor.
-- ------------------------------------------------------------
DO $$
DECLARE
    v_faltantes text;
BEGIN
    SELECT string_agg(exp.nombre, ', ')
      INTO v_faltantes
    FROM (VALUES
        ('Pintura histórica'),
        ('Cerámica y artesanía'),
        ('Patrimonio cultural'),
        ('Historia natural')
    ) AS exp(nombre)
    WHERE NOT EXISTS (SELECT 1 FROM sala s WHERE s.nombre = exp.nombre);

    IF v_faltantes IS NOT NULL THEN
        RAISE EXCEPTION 'V8: faltan salas requeridas: %', v_faltantes;
    END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Alta de los 12 sensores con su ubicacion resuelta.
--    - Ambientales: sala_id por nombre real, exhibicion_id NULL.
--    - Presencia:   exhibicion_id por ID real (1..8), sala_id NULL.
--    ON CONFLICT DO NOTHING: no duplica ni sobrescribe.
-- ------------------------------------------------------------
INSERT INTO sensor (codigo, tipo, categoria, sala_id, exhibicion_id, descripcion, estado) VALUES
    ('SENSOR-AMBIENTAL-001', 'MULTI',     'AMBIENTAL',
        (SELECT id FROM sala WHERE nombre = 'Pintura histórica'), NULL,
        'Sensor ambiental (temperatura, humedad y luminosidad) de la sala Pintura histórica.', 'ACTIVO'),
    ('SENSOR-AMBIENTAL-002', 'MULTI',     'AMBIENTAL',
        (SELECT id FROM sala WHERE nombre = 'Cerámica y artesanía'), NULL,
        'Sensor ambiental (temperatura, humedad y luminosidad) de la sala Cerámica y artesanía.', 'ACTIVO'),
    ('SENSOR-AMBIENTAL-003', 'MULTI',     'AMBIENTAL',
        (SELECT id FROM sala WHERE nombre = 'Patrimonio cultural'), NULL,
        'Sensor ambiental (temperatura, humedad y luminosidad) de la sala Patrimonio cultural.', 'ACTIVO'),
    ('SENSOR-AMBIENTAL-004', 'MULTI',     'AMBIENTAL',
        (SELECT id FROM sala WHERE nombre = 'Historia natural'), NULL,
        'Sensor ambiental (temperatura, humedad y luminosidad) de la sala Historia natural.', 'ACTIVO'),
    ('SENSOR-PRESENCIA-001', 'PRESENCIA', 'PRESENCIA', NULL, 1,
        'Sensor de presencia de la exhibición 1 (pintura-historica-02).', 'ACTIVO'),
    ('SENSOR-PRESENCIA-002', 'PRESENCIA', 'PRESENCIA', NULL, 2,
        'Sensor de presencia de la exhibición 2 (pintura-historica-01).', 'ACTIVO'),
    ('SENSOR-PRESENCIA-003', 'PRESENCIA', 'PRESENCIA', NULL, 3,
        'Sensor de presencia de la exhibición 3 (ceramica-artesania-02).', 'ACTIVO'),
    ('SENSOR-PRESENCIA-004', 'PRESENCIA', 'PRESENCIA', NULL, 4,
        'Sensor de presencia de la exhibición 4 (ceramica-artesania-01).', 'ACTIVO'),
    ('SENSOR-PRESENCIA-005', 'PRESENCIA', 'PRESENCIA', NULL, 5,
        'Sensor de presencia de la exhibición 5 (patrimonio-cultural-02).', 'ACTIVO'),
    ('SENSOR-PRESENCIA-006', 'PRESENCIA', 'PRESENCIA', NULL, 6,
        'Sensor de presencia de la exhibición 6 (patrimonio-cultural-01).', 'ACTIVO'),
    ('SENSOR-PRESENCIA-007', 'PRESENCIA', 'PRESENCIA', NULL, 7,
        'Sensor de presencia de la exhibición 7 (historia-natural-02).', 'ACTIVO'),
    ('SENSOR-PRESENCIA-008', 'PRESENCIA', 'PRESENCIA', NULL, 8,
        'Sensor de presencia de la exhibición 8 (historia-natural-01).', 'ACTIVO')
ON CONFLICT (codigo) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Verificacion final. Comprueba que los 12 sensores existen y que su
--    categoria, tipo y ubicacion son exactamente los esperados. Si algo no
--    cuadra (p. ej. un sensor preexistente mal ubicado), ABORTA la migracion
--    con un mensaje explicito y no se confirma.
-- ------------------------------------------------------------
DO $$
DECLARE
    v_problemas text;
BEGIN
    SELECT string_agg(
               format('%s [categoria=%s, tipo=%s, sala_id=%s, exhibicion_id=%s]',
                      exp.codigo, coalesce(s.categoria, 'AUSENTE'),
                      coalesce(s.tipo, '-'), coalesce(s.sala_id::text, 'NULL'),
                      coalesce(s.exhibicion_id::text, 'NULL')),
               '; ' ORDER BY exp.codigo)
      INTO v_problemas
    FROM (VALUES
        ('SENSOR-AMBIENTAL-001', 'AMBIENTAL', 'MULTI',     'Pintura histórica',   NULL::bigint),
        ('SENSOR-AMBIENTAL-002', 'AMBIENTAL', 'MULTI',     'Cerámica y artesanía', NULL::bigint),
        ('SENSOR-AMBIENTAL-003', 'AMBIENTAL', 'MULTI',     'Patrimonio cultural', NULL::bigint),
        ('SENSOR-AMBIENTAL-004', 'AMBIENTAL', 'MULTI',     'Historia natural',    NULL::bigint),
        ('SENSOR-PRESENCIA-001', 'PRESENCIA', 'PRESENCIA', NULL, 1),
        ('SENSOR-PRESENCIA-002', 'PRESENCIA', 'PRESENCIA', NULL, 2),
        ('SENSOR-PRESENCIA-003', 'PRESENCIA', 'PRESENCIA', NULL, 3),
        ('SENSOR-PRESENCIA-004', 'PRESENCIA', 'PRESENCIA', NULL, 4),
        ('SENSOR-PRESENCIA-005', 'PRESENCIA', 'PRESENCIA', NULL, 5),
        ('SENSOR-PRESENCIA-006', 'PRESENCIA', 'PRESENCIA', NULL, 6),
        ('SENSOR-PRESENCIA-007', 'PRESENCIA', 'PRESENCIA', NULL, 7),
        ('SENSOR-PRESENCIA-008', 'PRESENCIA', 'PRESENCIA', NULL, 8)
    ) AS exp(codigo, categoria, tipo, sala_nombre, exhibicion_id)
    LEFT JOIN sensor s ON s.codigo = exp.codigo
    LEFT JOIN sala   sa ON sa.nombre = exp.sala_nombre
    WHERE s.codigo IS NULL
       OR s.categoria <> exp.categoria
       OR s.tipo      <> exp.tipo
       OR (exp.categoria = 'AMBIENTAL'
           AND (s.sala_id IS DISTINCT FROM sa.id OR s.exhibicion_id IS NOT NULL))
       OR (exp.categoria = 'PRESENCIA'
           AND (s.exhibicion_id IS DISTINCT FROM exp.exhibicion_id OR s.sala_id IS NOT NULL));

    IF v_problemas IS NOT NULL THEN
        RAISE EXCEPTION 'V8: sensores con estado inesperado o ubicacion incompatible: %', v_problemas;
    END IF;
END $$;
