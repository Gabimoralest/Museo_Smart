-- ============================================================
-- Museo Smart - V15
-- Contenido definitivo de exhibiciones, exhibicion especial de la
-- estatua central y multimedia almacenada en el servidor local.
--
-- ESQUEMA (resumen):
--   1. exhibicion.descripcion_corta varchar(200) NULL  -> obligatoria en API.
--      exhibicion.dato_curioso      text NULL.
--      descripcion (V1) pasa a ser la descripcion completa (opcional).
--      contexto_historico y fecha_creacion_aprox se conservan pero dejan de
--      usarse en la API de edicion.
--   2. Nombres oficiales de las 12 exhibiciones (UPDATE por codigo).
--   3. Exhibicion especial "plaza-central-01" en la ubicacion EXH_CENTRO_01:
--      - ubicacion_3d.sala_id pasa a admitir NULL (solo para especiales).
--      - exhibicion.sala_id pasa a admitir NULL (solo para especiales).
--      - Se reemplaza trg_exhibicion_ubicacion_sala para exigir coherencia
--        bidireccional: sala NULL <=> ubicacion sin sala.
--      - trg_exhibicion_limite_sala ignora las especiales (sala NULL).
--      - La especial no tiene sensores ni limites ambientales.
--   4. contenido_multimedia adaptada a almacenamiento local:
--      - archivo_clave (clave en disco) UNIQUE, imagekit_id deja de ser
--        obligatoria.
--      - nombre_original, mime_type, tamano_bytes, subido_por.
--      - UNIQUE (exhibicion_id, tipo): maximo 1 IMAGEN + 1 VIDEO.
--      - es_principal y orden quedan sin uso.
--   5. v_ranking_exhibicion pasa a LEFT JOIN sala para no perder la especial
--      (mismas columnas).
--   6. Verificacion final.
--
-- No modifica V1-V14. Idempotente en lo posible (IF NOT EXISTS / OR REPLACE).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Campos nuevos de contenido.
-- ------------------------------------------------------------
ALTER TABLE exhibicion
    ADD COLUMN IF NOT EXISTS descripcion_corta varchar(200);

ALTER TABLE exhibicion
    ADD COLUMN IF NOT EXISTS dato_curioso text;

COMMENT ON COLUMN exhibicion.descripcion_corta IS
    'Descripcion breve para la ficha; obligatoria al guardar desde la API (max 200).';
COMMENT ON COLUMN exhibicion.dato_curioso IS
    'Dato curioso opcional mostrado en la ficha ampliada.';
COMMENT ON COLUMN exhibicion.descripcion IS
    'Descripcion completa (opcional). Antes era la unica descripcion.';

-- ------------------------------------------------------------
-- 2. Nombres oficiales (por codigo, sin [PROVISIONAL]).
--    Se aborta si falta algun codigo esperado.
-- ------------------------------------------------------------
DO $$
DECLARE
    v_faltantes text;
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
        ('civilizaciones-antiguas-02')
    ) AS exp(codigo)
    WHERE NOT EXISTS (SELECT 1 FROM exhibicion e WHERE e.codigo = exp.codigo);

    IF v_faltantes IS NOT NULL THEN
        RAISE EXCEPTION 'V15: faltan exhibiciones requeridas por codigo: %', v_faltantes;
    END IF;
END $$;

UPDATE exhibicion e
SET titulo = v.titulo
FROM (VALUES
    ('pintura-historica-01',       'Washington cruzando el Delaware'),
    ('pintura-historica-02',       'Paisaje al atardecer'),
    ('ceramica-artesania-01',      'Vasija baluster'),
    ('ceramica-artesania-02',      'Quemador de incienso'),
    ('patrimonio-cultural-01',     'Zun en forma de elefante'),
    ('patrimonio-cultural-02',     'Estatua de gato'),
    ('historia-natural-01',        'Triceratops horridus'),
    ('historia-natural-02',        'Diente de megalodón'),
    ('escultura-retratos-01',      'Busto de Pilato'),
    ('escultura-retratos-02',      'Cabeza de león'),
    ('civilizaciones-antiguas-01', 'Estatua de Kefrén'),
    ('civilizaciones-antiguas-02', 'Estatua de Ramsés II')
) AS v(codigo, titulo)
WHERE e.codigo = v.codigo
  AND e.titulo IS DISTINCT FROM v.titulo;

-- ------------------------------------------------------------
-- 3. Exhibicion especial de la estatua central.
-- ------------------------------------------------------------

-- 3.1 ubicacion_3d.sala_id admite NULL (solo para especiales).
ALTER TABLE ubicacion_3d
    ALTER COLUMN sala_id DROP NOT NULL;

COMMENT ON COLUMN ubicacion_3d.sala_id IS
    'Sala de la ubicacion. NULL solo para ubicaciones especiales (p. ej. EXH_CENTRO_01).';

-- 3.2 exhibicion.sala_id admite NULL (solo para especiales).
ALTER TABLE exhibicion
    ALTER COLUMN sala_id DROP NOT NULL;

COMMENT ON COLUMN exhibicion.sala_id IS
    'Sala de la exhibicion. NULL solo para la exhibicion especial (plaza central).';

-- 3.3 Trigger de coherencia sala/ubicacion (reemplazo ANTES de insertar la
--     especial: el trigger de V12 rechazaria una ubicacion sin sala).
--     Reglas:
--       - Si la exhibicion tiene ubicacion, su sala debe coincidir con la de
--         la ubicacion (NULL = NULL vale). "No existe" se detecta con FOUND.
--       - Una ubicacion INACTIVA no admite exhibiciones.
--       - Si la exhibicion NO tiene sala, debe tener ubicacion (la especial).
CREATE OR REPLACE FUNCTION trg_exhibicion_ubicacion_sala() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_sala_ubicacion bigint;
    v_estado         varchar(20);
    v_cambio         boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_cambio := NEW.ubicacion_3d_id IS NOT NULL;
    ELSE
        v_cambio := NEW.ubicacion_3d_id IS DISTINCT FROM OLD.ubicacion_3d_id;
    END IF;

    -- Exhibicion sin sala: solo puede existir si tiene ubicacion (especial).
    IF NEW.sala_id IS NULL AND NEW.ubicacion_3d_id IS NULL THEN
        RAISE EXCEPTION 'La exhibicion % no tiene sala ni ubicacion 3D', NEW.codigo
            USING ERRCODE = 'check_violation';
    END IF;

    IF v_cambio THEN
        IF NEW.ubicacion_3d_id IS NOT NULL THEN
            SELECT u.sala_id, u.estado
              INTO v_sala_ubicacion, v_estado
            FROM ubicacion_3d u
            WHERE u.id = NEW.ubicacion_3d_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'La ubicacion_3d % no existe', NEW.ubicacion_3d_id
                    USING ERRCODE = 'foreign_key_violation';
            END IF;

            -- Coherencia bidireccional (NULL = NULL es valido para especiales).
            IF v_sala_ubicacion IS DISTINCT FROM NEW.sala_id THEN
                RAISE EXCEPTION 'La exhibicion % (sala %) no coincide con la sala de su ubicacion 3D (%)',
                    NEW.codigo, coalesce(NEW.sala_id::text, 'NULL'), coalesce(v_sala_ubicacion::text, 'NULL')
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
    'Exige coherencia sala/ubicacion (NULL solo para especiales), rechaza ubicaciones INACTIVAS y sincroniza OCUPADA/DISPONIBLE.';

DROP TRIGGER IF EXISTS trg_exhibicion_ubicacion_sala ON exhibicion;
CREATE TRIGGER trg_exhibicion_ubicacion_sala
    BEFORE INSERT OR UPDATE ON exhibicion
    FOR EACH ROW EXECUTE FUNCTION trg_exhibicion_ubicacion_sala();

-- 3.4 Trigger de 2 por sala: ignora las especiales (sala NULL).
CREATE OR REPLACE FUNCTION trg_exhibicion_limite_sala() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_count integer;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Las exhibiciones especiales (sala NULL) no cuentan para el limite.
        IF NEW.sala_id IS NULL THEN
            RETURN NEW;
        END IF;
        PERFORM pg_advisory_xact_lock(hashtext('museo_smart.exhibicion.sala:' || NEW.sala_id::text));
        SELECT count(*) INTO v_count FROM exhibicion WHERE sala_id = NEW.sala_id;
        IF v_count >= 2 THEN
            RAISE EXCEPTION 'La sala % ya tiene el maximo de 2 exhibiciones', NEW.sala_id
                USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.sala_id IS DISTINCT FROM OLD.sala_id THEN
            -- Si el destino es una especial (sala NULL), no aplica el limite.
            IF NEW.sala_id IS NULL THEN
                RETURN NEW;
            END IF;
            PERFORM pg_advisory_xact_lock(
                hashtext('museo_smart.exhibicion.sala:' || LEAST(NEW.sala_id, OLD.sala_id)::text));
            PERFORM pg_advisory_xact_lock(
                hashtext('museo_smart.exhibicion.sala:' || GREATEST(NEW.sala_id, OLD.sala_id)::text));
            SELECT count(*) INTO v_count FROM exhibicion WHERE sala_id = NEW.sala_id;
            IF v_count >= 2 THEN
                RAISE EXCEPTION 'La sala destino % ya tiene el maximo de 2 exhibiciones', NEW.sala_id
                    USING ERRCODE = 'check_violation';
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_exhibicion_limite_sala() IS
    'Impide mas de 2 exhibiciones por sala; las especiales (sala NULL) quedan fuera del limite.';

DROP TRIGGER IF EXISTS trg_exhibicion_limite_sala ON exhibicion;
CREATE TRIGGER trg_exhibicion_limite_sala
    BEFORE INSERT OR UPDATE ON exhibicion
    FOR EACH ROW EXECUTE FUNCTION trg_exhibicion_limite_sala();

-- 3.5 Nueva ubicacion especial.
INSERT INTO ubicacion_3d (codigo, sala_id, nombre_blender, tipo, three_x, three_y, three_z, estado)
SELECT 'EXH_CENTRO_01', NULL, 'Estatua_Central', 'ESTATUA', NULL, NULL, NULL, 'OCUPADA'
WHERE NOT EXISTS (SELECT 1 FROM ubicacion_3d u WHERE u.codigo = 'EXH_CENTRO_01');

-- 3.6 Nueva exhibicion especial.
INSERT INTO exhibicion (sala_id, codigo, titulo, descripcion, activa, ubicacion_3d_id)
SELECT NULL,
       'plaza-central-01',
       'Estatua gótica',
       'Escultura central del museo ubicada en la plaza central.',
       true,
       (SELECT u.id FROM ubicacion_3d u WHERE u.codigo = 'EXH_CENTRO_01')
WHERE NOT EXISTS (SELECT 1 FROM exhibicion e WHERE e.codigo = 'plaza-central-01');

-- 3.7 La especial no tiene limites ambientales ni sensores.
UPDATE exhibicion
SET temp_min_c = NULL, temp_max_c = NULL,
    humedad_min_pct = NULL, humedad_max_pct = NULL, luz_max_lux = NULL
WHERE codigo = 'plaza-central-01';

-- ------------------------------------------------------------
-- 4. contenido_multimedia -> almacenamiento local.
-- ------------------------------------------------------------
ALTER TABLE contenido_multimedia
    ALTER COLUMN imagekit_id DROP NOT NULL;

ALTER TABLE contenido_multimedia
    ALTER COLUMN url DROP NOT NULL;

ALTER TABLE contenido_multimedia
    ADD COLUMN IF NOT EXISTS archivo_clave varchar(400);

ALTER TABLE contenido_multimedia
    ADD COLUMN IF NOT EXISTS nombre_original varchar(400);

ALTER TABLE contenido_multimedia
    ADD COLUMN IF NOT EXISTS mime_type varchar(120);

ALTER TABLE contenido_multimedia
    ADD COLUMN IF NOT EXISTS tamano_bytes bigint;

ALTER TABLE contenido_multimedia
    ADD COLUMN IF NOT EXISTS subido_por bigint REFERENCES usuario_admin(id) ON DELETE SET NULL;

COMMENT ON COLUMN contenido_multimedia.archivo_clave IS
    'Nombre/ruta relativa del archivo en APP_MEDIA_DIR (p. ej. 12/uuid.jpg). Unico.';
COMMENT ON COLUMN contenido_multimedia.subido_por IS
    'Administrador que subio el archivo.';
COMMENT ON COLUMN contenido_multimedia.imagekit_id IS
    'Obsoleto: se conserva por compatibilidad. Ya no es obligatorio.';
COMMENT ON COLUMN contenido_multimedia.es_principal IS
    'Obsoleto en el almacenamiento local: maximo 1 IMAGEN y 1 VIDEO por exhibicion.';
COMMENT ON COLUMN contenido_multimedia.orden IS
    'Obsoleto en el almacenamiento local.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_multimedia_archivo_clave
    ON contenido_multimedia (archivo_clave)
    WHERE archivo_clave IS NOT NULL;

-- Maximo 1 IMAGEN y 1 VIDEO por exhibicion.
CREATE UNIQUE INDEX IF NOT EXISTS uq_multimedia_exhibicion_tipo
    ON contenido_multimedia (exhibicion_id, tipo);

-- ------------------------------------------------------------
-- 5. Ranking: LEFT JOIN sala para no perder la exhibicion especial.
--    Mismas columnas y orden que V3:97 / V14 (contrato de
--    RankingExhibicionView).
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_ranking_exhibicion AS
SELECT
    e.id                        AS exhibicion_id,
    e.codigo,
    e.titulo,
    s.id                        AS sala_id,
    s.nombre                    AS sala_nombre,
    count(v.id)                 AS total_visitas_validas
FROM exhibicion e
LEFT JOIN sala s ON s.id = e.sala_id
LEFT JOIN visita v ON v.exhibicion_id = e.id AND v.valida
WHERE e.activa
GROUP BY e.id, e.codigo, e.titulo, s.id, s.nombre;

COMMENT ON VIEW v_ranking_exhibicion IS
    'Ranking de popularidad (visitas validadas), incluye la exhibicion especial (sala NULL).';

-- ------------------------------------------------------------
-- 6. Verificacion final.
-- ------------------------------------------------------------
DO $$
DECLARE
    v_exhibiciones integer;
    v_con_sala     integer;
    v_especiales   integer;
    v_ocupadas     integer;
    v_con_limites  integer;
    v_sensores_esp integer;
    v_problemas    text;
BEGIN
    SELECT count(*) INTO v_exhibiciones FROM exhibicion;
    SELECT count(*) INTO v_con_sala     FROM exhibicion WHERE sala_id IS NOT NULL;
    SELECT count(*) INTO v_especiales   FROM exhibicion WHERE sala_id IS NULL;
    SELECT count(*) INTO v_ocupadas     FROM ubicacion_3d WHERE estado = 'OCUPADA';
    SELECT count(*) INTO v_con_limites  FROM exhibicion
     WHERE codigo = 'plaza-central-01'
       AND (temp_min_c IS NOT NULL OR temp_max_c IS NOT NULL
            OR humedad_min_pct IS NOT NULL OR humedad_max_pct IS NOT NULL
            OR luz_max_lux IS NOT NULL);
    SELECT count(*) INTO v_sensores_esp FROM sensor s
      JOIN exhibicion e ON e.id = s.exhibicion_id
     WHERE e.codigo = 'plaza-central-01';

    IF v_exhibiciones <> 13 THEN
        RAISE EXCEPTION 'V15: se esperaban 13 exhibiciones, hay %', v_exhibiciones;
    END IF;
    IF v_con_sala <> 12 THEN
        RAISE EXCEPTION 'V15: se esperaban 12 exhibiciones con sala, hay %', v_con_sala;
    END IF;
    IF v_especiales <> 1 THEN
        RAISE EXCEPTION 'V15: se esperaba 1 exhibicion especial (sin sala), hay %', v_especiales;
    END IF;
    IF v_ocupadas <> 13 THEN
        RAISE EXCEPTION 'V15: se esperaban 13 ubicaciones OCUPADA, hay %', v_ocupadas;
    END IF;
    IF v_con_limites <> 0 THEN
        RAISE EXCEPTION 'V15: la exhibicion especial no debe tener limites ambientales';
    END IF;
    IF v_sensores_esp <> 0 THEN
        RAISE EXCEPTION 'V15: la exhibicion especial no debe tener sensores';
    END IF;

    -- Nombres oficiales aplicados.
    SELECT string_agg(exp.codigo, ', ' ORDER BY exp.codigo)
      INTO v_problemas
    FROM (VALUES
        ('pintura-historica-01',       'Washington cruzando el Delaware'),
        ('pintura-historica-02',       'Paisaje al atardecer'),
        ('ceramica-artesania-01',      'Vasija baluster'),
        ('ceramica-artesania-02',      'Quemador de incienso'),
        ('patrimonio-cultural-01',     'Zun en forma de elefante'),
        ('patrimonio-cultural-02',     'Estatua de gato'),
        ('historia-natural-01',        'Triceratops horridus'),
        ('historia-natural-02',        'Diente de megalodón'),
        ('escultura-retratos-01',      'Busto de Pilato'),
        ('escultura-retratos-02',      'Cabeza de león'),
        ('civilizaciones-antiguas-01', 'Estatua de Kefrén'),
        ('civilizaciones-antiguas-02', 'Estatua de Ramsés II'),
        ('plaza-central-01',           'Estatua gótica')
    ) AS exp(codigo, titulo)
    WHERE NOT EXISTS (
        SELECT 1 FROM exhibicion e WHERE e.codigo = exp.codigo AND e.titulo = exp.titulo
    );

    IF v_problemas IS NOT NULL THEN
        RAISE EXCEPTION 'V15: titulos no aplicados: %', v_problemas;
    END IF;
END $$;
