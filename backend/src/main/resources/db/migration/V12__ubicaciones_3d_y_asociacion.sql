-- ============================================================
-- Museo Smart - V12
-- Ubicaciones fisicas del modelo 3D (lugar fijo) y su asociacion con
-- las exhibiciones (contenido).
--
-- Separacion de conceptos:
--   ubicacion_3d = punto del GLB (coordenadas three_x/y/z, nombre del nodo
--                  de Blender). Es infraestructura, no contenido.
--   exhibicion   = contenido curatorial que se coloca en una ubicacion.
--
-- Reglas:
--   - 12 ubicaciones semilla (EXH_S1_01..EXH_S6_02). NO se incluye
--     EXH_CENTRO_01 en esta tarea.
--   - Una ubicacion aloja como maximo UNA exhibicion (UNIQUE en exhibicion).
--   - Una exhibicion NO puede apuntar a una ubicacion de OTRA sala
--     (trigger trg_exhibicion_ubicacion_sala).
--   - Una ubicacion INACTIVA no puede recibir exhibiciones.
--   - Al asociar/desasociar, el estado de la ubicacion pasa a OCUPADA /
--     DISPONIBLE automaticamente.
--
-- Coordenadas: el fichero inventario_exhibiciones.csv NO esta en el
-- repositorio, por lo que three_x/three_y/three_z quedan NULL (no se
-- inventan valores). Se rellenaran en una migracion posterior cuando exista
-- el inventario real del GLB.
--
-- ADITIVA: no modifica V1-V11 ni borra/recrea filas existentes.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabla ubicacion_3d
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ubicacion_3d (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo         varchar(30) NOT NULL,
    sala_id        bigint      NOT NULL REFERENCES sala(id) ON DELETE RESTRICT,
    nombre_blender varchar(120),
    tipo           varchar(20),
    three_x        numeric(10,4),
    three_y        numeric(10,4),
    three_z        numeric(10,4),
    estado         varchar(20) NOT NULL DEFAULT 'DISPONIBLE',
    creado_en      timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_ubicacion_3d_codigo UNIQUE (codigo),
    CONSTRAINT ck_ubicacion_3d_tipo   CHECK (tipo IS NULL OR tipo IN ('PINTURA', 'VITRINA', 'ESTATUA')),
    CONSTRAINT ck_ubicacion_3d_estado CHECK (estado IN ('DISPONIBLE', 'OCUPADA', 'INACTIVA'))
);

COMMENT ON TABLE  ubicacion_3d            IS 'Puntos fijos del modelo 3D de Blender; el contenido (exhibicion) se asocia despues.';
COMMENT ON COLUMN ubicacion_3d.codigo     IS 'Codigo del nodo del GLB, p. ej. EXH_S1_01. Estable y unico.';
COMMENT ON COLUMN ubicacion_3d.estado     IS 'DISPONIBLE (libre), OCUPADA (tiene exhibicion), INACTIVA (fuera de uso).';
COMMENT ON COLUMN ubicacion_3d.three_x    IS 'Coordenada X en el GLB. NULL mientras no exista inventario.csv.';

CREATE INDEX IF NOT EXISTS idx_ubicacion_3d_sala ON ubicacion_3d (sala_id);

DROP TRIGGER IF EXISTS trg_ubicacion_3d_actualizado_en ON ubicacion_3d;
CREATE TRIGGER trg_ubicacion_3d_actualizado_en
    BEFORE UPDATE ON ubicacion_3d
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

-- ------------------------------------------------------------
-- 2. Semilla de 12 ubicaciones (idempotente por codigo).
--    sala resuelta por sala.codigo_3d (SALA_1..SALA_6), nunca por id.
--    three_* = NULL: no hay inventario_exhibiciones.csv en el repo.
-- ------------------------------------------------------------
INSERT INTO ubicacion_3d (codigo, sala_id, nombre_blender, tipo, three_x, three_y, three_z, estado)
SELECT v.codigo,
       (SELECT s.id FROM sala s WHERE s.codigo_3d = v.sala_codigo),
       v.nombre_blender,
       v.tipo,
       NULL, NULL, NULL,
       'DISPONIBLE'
FROM (VALUES
    ('EXH_S1_01', 'SALA_1', 'Cuadro_pintura',           'PINTURA'),
    ('EXH_S1_02', 'SALA_1', 'Cuadro_Pintura_Sala1_2',   'PINTURA'),
    ('EXH_S2_01', 'SALA_2', 'Vitrina_vasija',           'VITRINA'),
    ('EXH_S2_02', 'SALA_2', 'Vitrina_quemador',         'VITRINA'),
    ('EXH_S3_01', 'SALA_3', 'Vitrina_elefante',         'VITRINA'),
    ('EXH_S3_02', 'SALA_3', 'Vitrina_gato',             'VITRINA'),
    ('EXH_S4_01', 'SALA_4', 'Vitrina_triceratops',      'VITRINA'),
    ('EXH_S4_02', 'SALA_4', 'Vitrina_diente',           'VITRINA'),
    ('EXH_S5_01', 'SALA_5', 'Vitrina_busto',            'VITRINA'),
    ('EXH_S5_02', 'SALA_5', 'Vitrina_leon',             'VITRINA'),
    ('EXH_S6_01', 'SALA_6', 'Vitrina_egipto1',          'VITRINA'),
    ('EXH_S6_02', 'SALA_6', 'Vitrina_egipto2',          'VITRINA')
) AS v(codigo, sala_codigo, nombre_blender, tipo)
WHERE NOT EXISTS (SELECT 1 FROM ubicacion_3d u WHERE u.codigo = v.codigo);

-- ------------------------------------------------------------
-- 3. exhibicion.ubicacion_3d_id (1:1 con la ubicacion).
-- ------------------------------------------------------------
ALTER TABLE exhibicion
    ADD COLUMN IF NOT EXISTS ubicacion_3d_id bigint
        REFERENCES ubicacion_3d(id) ON DELETE RESTRICT;

COMMENT ON COLUMN exhibicion.ubicacion_3d_id IS
    'Ubicacion fisica (GLB) donde se muestra la exhibicion. NULL = sin asignar. Una ubicacion solo puede tener una exhibicion.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_exhibicion_ubicacion_3d
    ON exhibicion (ubicacion_3d_id)
    WHERE ubicacion_3d_id IS NOT NULL;

-- ------------------------------------------------------------
-- 4. Trigger de coherencia sala/ubicacion + sincronizacion de estado.
--    - Rechaza asociar una ubicacion de OTRA sala.
--    - Rechaza asociar una ubicacion INACTIVA.
--    - Marca la ubicacion como OCUPADA al asociarla y DISPONIBLE al
--      desasociarla (solo cuando ubicacion_3d_id cambia).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_exhibicion_ubicacion_sala() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_sala_ubicacion bigint;
    v_estado         varchar(20);
    v_cambio         boolean;
BEGIN
    -- En INSERT no se puede leer OLD (registro no asignado); solo se actua
    -- si la fila trae ya una ubicacion.
    IF TG_OP = 'INSERT' THEN
        v_cambio := NEW.ubicacion_3d_id IS NOT NULL;
    ELSE
        v_cambio := NEW.ubicacion_3d_id IS DISTINCT FROM OLD.ubicacion_3d_id;
    END IF;

    IF v_cambio THEN
        IF NEW.ubicacion_3d_id IS NOT NULL THEN
            SELECT u.sala_id, u.estado
              INTO v_sala_ubicacion, v_estado
            FROM ubicacion_3d u
            WHERE u.id = NEW.ubicacion_3d_id;

            IF v_sala_ubicacion IS NULL THEN
                RAISE EXCEPTION 'La ubicacion_3d % no existe', NEW.ubicacion_3d_id
                    USING ERRCODE = 'foreign_key_violation';
            END IF;
            IF v_sala_ubicacion IS DISTINCT FROM NEW.sala_id THEN
                RAISE EXCEPTION 'La exhibicion % (sala %) no puede asociarse a la ubicacion % de la sala %',
                    NEW.codigo, NEW.sala_id, NEW.ubicacion_3d_id, v_sala_ubicacion
                    USING ERRCODE = 'check_violation';
            END IF;
            IF v_estado = 'INACTIVA' THEN
                RAISE EXCEPTION 'La ubicacion_3d % esta INACTIVA y no admite exhibiciones', NEW.ubicacion_3d_id
                    USING ERRCODE = 'check_violation';
            END IF;

            UPDATE ubicacion_3d SET estado = 'OCUPADA' WHERE id = NEW.ubicacion_3d_id;

        ELSIF TG_OP = 'UPDATE' AND OLD.ubicacion_3d_id IS NOT NULL THEN
            UPDATE ubicacion_3d
               SET estado = 'DISPONIBLE'
             WHERE id = OLD.ubicacion_3d_id AND estado = 'OCUPADA';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_exhibicion_ubicacion_sala() IS
    'Impide asociar una exhibicion a una ubicacion de otra sala o INACTIVA, y sincroniza el estado OCUPADA/DISPONIBLE.';

DROP TRIGGER IF EXISTS trg_exhibicion_ubicacion_sala ON exhibicion;
CREATE TRIGGER trg_exhibicion_ubicacion_sala
    BEFORE INSERT OR UPDATE ON exhibicion
    FOR EACH ROW EXECUTE FUNCTION trg_exhibicion_ubicacion_sala();

-- ------------------------------------------------------------
-- 5. Asociacion de las 8 exhibiciones existentes (V5) a la ubicacion de
--    SU MISMA sala. Emparejamiento explicito por codigo (no por id):
--      pintura-historica-0N  <-> EXH_S1_0N
--      ceramica-artesania-0N <-> EXH_S2_0N
--      patrimonio-cultural-0N<-> EXH_S3_0N
--      historia-natural-0N   <-> EXH_S4_0N
--    Dentro de cada sala el orden es por codigo (01 antes que 02).
--    El trigger de arriba marca la ubicacion como OCUPADA.
-- ------------------------------------------------------------
UPDATE exhibicion e
SET ubicacion_3d_id = u.id
FROM (VALUES
    ('pintura-historica-01',    'EXH_S1_01'),
    ('pintura-historica-02',    'EXH_S1_02'),
    ('ceramica-artesania-01',   'EXH_S2_01'),
    ('ceramica-artesania-02',   'EXH_S2_02'),
    ('patrimonio-cultural-01',  'EXH_S3_01'),
    ('patrimonio-cultural-02',  'EXH_S3_02'),
    ('historia-natural-01',     'EXH_S4_01'),
    ('historia-natural-02',     'EXH_S4_02')
) AS v(exhibicion_codigo, ubicacion_codigo)
JOIN ubicacion_3d u ON u.codigo = v.ubicacion_codigo
WHERE e.codigo = v.exhibicion_codigo
  AND e.ubicacion_3d_id IS DISTINCT FROM u.id;

-- ------------------------------------------------------------
-- 6. Verificacion: 12 ubicaciones, las 8 exhibiciones existentes con
--    ubicacion de su misma sala y estado OCUPADA coherente.
-- ------------------------------------------------------------
DO $$
DECLARE
    v_total_ubi      integer;
    v_problemas      text;
    v_ocupadas       integer;
BEGIN
    SELECT count(*) INTO v_total_ubi FROM ubicacion_3d;
    IF v_total_ubi <> 12 THEN
        RAISE EXCEPTION 'V12: se esperaban 12 ubicaciones_3d, hay %', v_total_ubi;
    END IF;

    SELECT string_agg(e.codigo || ' -> ' || coalesce(u.codigo, 'SIN_UBICACION'), ', ' ORDER BY e.codigo)
      INTO v_problemas
    FROM exhibicion e
    LEFT JOIN ubicacion_3d u ON u.id = e.ubicacion_3d_id
    WHERE e.codigo IN (
            'pintura-historica-01', 'pintura-historica-02',
            'ceramica-artesania-01', 'ceramica-artesania-02',
            'patrimonio-cultural-01', 'patrimonio-cultural-02',
            'historia-natural-01', 'historia-natural-02')
      AND (u.id IS NULL OR u.sala_id IS DISTINCT FROM e.sala_id);

    IF v_problemas IS NOT NULL THEN
        RAISE EXCEPTION 'V12: exhibiciones mal asociadas a su ubicacion 3D: %', v_problemas;
    END IF;

    SELECT count(*) INTO v_ocupadas FROM ubicacion_3d WHERE estado = 'OCUPADA';
    IF v_ocupadas < 8 THEN
        RAISE EXCEPTION 'V12: se esperaban al menos 8 ubicaciones OCUPADA tras asociar las 8 exhibiciones, hay %', v_ocupadas;
    END IF;

    -- Las 8 exhibiciones existentes deben tener su ubicacion en estado OCUPADA.
    SELECT string_agg(e.codigo, ', ' ORDER BY e.codigo)
      INTO v_problemas
    FROM exhibicion e
    JOIN ubicacion_3d u ON u.id = e.ubicacion_3d_id
    WHERE e.codigo IN (
            'pintura-historica-01', 'pintura-historica-02',
            'ceramica-artesania-01', 'ceramica-artesania-02',
            'patrimonio-cultural-01', 'patrimonio-cultural-02',
            'historia-natural-01', 'historia-natural-02')
      AND u.estado <> 'OCUPADA';

    IF v_problemas IS NOT NULL THEN
        RAISE EXCEPTION 'V12: ubicaciones de las 8 exhibiciones existentes no estan OCUPADA: %', v_problemas;
    END IF;
END $$;
