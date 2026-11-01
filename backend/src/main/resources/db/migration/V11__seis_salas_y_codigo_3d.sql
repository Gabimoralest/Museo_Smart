-- ============================================================
-- Museo Smart - V11
-- Ampliacion de 4 a 6 salas y codigo estable del modelo 3D (Blender).
--
-- Contexto:
--   V1 fijo el limite en 4 salas mediante trg_sala_limite (V1:52-74).
--   V5 creo las 4 salas existentes:
--     'Pintura histórica', 'Cerámica y artesanía',
--     'Patrimonio cultural', 'Historia natural'
--   El nuevo modelo 3D de Blender tiene 6 salas. Esta migracion:
--     1. Reemplaza la funcion del trigger para permitir hasta 6 salas
--        (la 7.a se sigue rechazando). El trigger trg_sala_limite no se toca.
--     2. Inserta las salas 5 y 6 de forma IDEMPOTENTE (solo si no existen
--        por nombre).
--     3. Agrega sala.codigo_3d (SALA_1..SALA_6), UNIQUE y NOT NULL,
--        resolviendo el mapeo SIEMPRE por NOMBRE, nunca por id numerico.
--
-- Si alguno de los 4 nombres existentes no coincide EXACTAMENTE con el
-- esperado, la migracion ABORTA (no se adivina el mapeo).
--
-- ADITIVA: no modifica V1-V10 ni borra/renombra filas existentes.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Permitir hasta 6 salas. Se conserva el advisory lock transaccional
--    y la misma clave de bloqueo, para que el codigo viejo y el nuevo se
--    serialicen entre si. La 7.a sala se rechaza.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_sala_limite() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_count integer;
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM pg_advisory_xact_lock(hashtext('museo_smart.sala.limite'));
        SELECT count(*) INTO v_count FROM sala;
        IF v_count >= 6 THEN
            RAISE EXCEPTION 'No se pueden crear mas de 6 salas (existen %)', v_count
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_sala_limite() IS
    'Impide insertar una septima sala (maximo 6). Usa advisory lock transaccional para soportar concurrencia.';

-- ------------------------------------------------------------
-- 2. Columna codigo_3d (se agrega NULL y se completa antes de NOT NULL).
-- ------------------------------------------------------------
ALTER TABLE sala
    ADD COLUMN IF NOT EXISTS codigo_3d varchar(20);

COMMENT ON COLUMN sala.codigo_3d IS
    'Codigo estable de la sala en el modelo 3D (Blender): SALA_1..SALA_6. Unico.';

-- ------------------------------------------------------------
-- 3. Salas 5 y 6 (idempotente por nombre). El trigger ya permite 6.
-- ------------------------------------------------------------
INSERT INTO sala (nombre, descripcion, estado, orden)
SELECT v.nombre, v.descripcion, 'activa', v.orden
FROM (VALUES
    ('Escultura y retratos', 'Sala dedicada a la escultura y los retratos.', 5::smallint),
    ('Civilizaciones antiguas', 'Sala dedicada a las civilizaciones antiguas.', 6::smallint)
) AS v(nombre, descripcion, orden)
WHERE NOT EXISTS (SELECT 1 FROM sala s WHERE s.nombre = v.nombre);

-- ------------------------------------------------------------
-- 4. Mapeo NOMBRE -> codigo_3d. Si un nombre no coincide, el bloque
--    verificador de abajo aborta la migracion.
-- ------------------------------------------------------------
UPDATE sala s
SET codigo_3d = v.codigo
FROM (VALUES
    ('Pintura histórica',     'SALA_1'),
    ('Cerámica y artesanía',  'SALA_2'),
    ('Patrimonio cultural',   'SALA_3'),
    ('Historia natural',      'SALA_4'),
    ('Escultura y retratos',  'SALA_5'),
    ('Civilizaciones antiguas', 'SALA_6')
) AS v(nombre, codigo)
WHERE s.nombre = v.nombre
  AND s.codigo_3d IS DISTINCT FROM v.codigo;

-- ------------------------------------------------------------
-- 5. Verificacion previa a NOT NULL: las 6 salas esperadas deben existir
--    y tener SU codigo_3d exacto. Cualquier sobrante tambien se reporta.
-- ------------------------------------------------------------
DO $$
DECLARE
    v_problemas text;
    v_total integer;
BEGIN
    SELECT string_agg(exp.nombre || ' -> ' || exp.codigo, ', ' ORDER BY exp.codigo)
      INTO v_problemas
    FROM (VALUES
        ('Pintura histórica',       'SALA_1'),
        ('Cerámica y artesanía',    'SALA_2'),
        ('Patrimonio cultural',     'SALA_3'),
        ('Historia natural',        'SALA_4'),
        ('Escultura y retratos',    'SALA_5'),
        ('Civilizaciones antiguas', 'SALA_6')
    ) AS exp(nombre, codigo)
    WHERE NOT EXISTS (
        SELECT 1 FROM sala s
        WHERE s.nombre = exp.nombre AND s.codigo_3d = exp.codigo
    );

    IF v_problemas IS NOT NULL THEN
        RAISE EXCEPTION 'V11: salas no encontradas o con codigo_3d inesperado: %', v_problemas;
    END IF;

    SELECT count(*) INTO v_total FROM sala;
    IF v_total <> 6 THEN
        RAISE EXCEPTION 'V11: se esperaban exactamente 6 salas, hay %', v_total;
    END IF;
END $$;

-- ------------------------------------------------------------
-- 6. Unicidad y NOT NULL del codigo 3D.
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_sala_codigo_3d ON sala (codigo_3d);

ALTER TABLE sala
    ALTER COLUMN codigo_3d SET NOT NULL;
