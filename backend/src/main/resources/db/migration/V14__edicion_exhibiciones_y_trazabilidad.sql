-- ============================================================
-- Museo Smart - V14
-- Soporte de edicion de exhibiciones por ADMIN/SUPERADMIN y trazabilidad.
--
-- Se prepara SOLO el esquema; el backend (siguiente paso) es quien:
--   - actualiza actualizado_por / actualizado_en,
--   - incrementa version (bloqueo optimista),
--   - inserta filas en exhibicion_edicion_historial.
--
-- Reglas de negocio fijadas en la base:
--   - El campo codigo NO es editable: un trigger BEFORE UPDATE lo impide.
--   - ubicacion_3d_id queda fuera de la edicion normal (lo gestiona V12);
--     no se protege con trigger aqui porque el backend no debe exponerlo,
--     pero SI se documenta como no editable.
--
-- Ademas corrige v_ranking_exhibicion para excluir exhibiciones inactivas,
-- conservando EXACTAMENTE las mismas columnas y orden (el backend la
-- proyecta en RankingExhibicionView; no se puede romper ese contrato).
--
-- ADITIVA e IDEMPOTENTE. No modifica V1-V13.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columnas de auditoria y bloqueo optimista en exhibicion.
-- ------------------------------------------------------------
ALTER TABLE exhibicion
    ADD COLUMN IF NOT EXISTS actualizado_por bigint
        REFERENCES usuario_admin(id) ON DELETE SET NULL;

ALTER TABLE exhibicion
    ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN exhibicion.actualizado_por IS
    'Ultimo usuario ADMIN/SUPERADMIN que edito la exhibicion (NULL si nunca se edito).';
COMMENT ON COLUMN exhibicion.version IS
    'Version para bloqueo optimista. El backend debe incrementarla en cada UPDATE y comparar la leida.';

-- ------------------------------------------------------------
-- 2. Tabla de historial de ediciones de campos.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exhibicion_edicion_historial (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exhibicion_id  bigint      NOT NULL REFERENCES exhibicion(id) ON DELETE RESTRICT,
    campo          varchar(80) NOT NULL,
    valor_anterior text,
    valor_nuevo    text,
    editado_por    bigint      REFERENCES usuario_admin(id) ON DELETE SET NULL,
    editado_en     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  exhibicion_edicion_historial IS
    'Historial campo a campo de las ediciones de exhibicion; lo llena el backend en la edicion.';
COMMENT ON COLUMN exhibicion_edicion_historial.campo IS
    'Nombre del campo editado (p. ej. titulo, descripcion, periodo).';
COMMENT ON COLUMN exhibicion_edicion_historial.editado_por IS
    'Usuario que hizo la edicion; NULL si se desconoce o se borro la cuenta.';

CREATE INDEX IF NOT EXISTS idx_edicion_historial_exhibicion
    ON exhibicion_edicion_historial (exhibicion_id);

CREATE INDEX IF NOT EXISTS idx_edicion_historial_editado_en
    ON exhibicion_edicion_historial (editado_en);

-- ------------------------------------------------------------
-- 3. Proteger codigo: no se puede cambiar tras el INSERT.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_exhibicion_codigo_inmutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.codigo IS DISTINCT FROM OLD.codigo THEN
        RAISE EXCEPTION 'El codigo de la exhibicion no es editable (id %, % -> %)',
            OLD.id, OLD.codigo, NEW.codigo
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_exhibicion_codigo_inmutable() IS
    'Impide modificar exhibicion.codigo; el codigo es estable (URLs y referencias externas).';

DROP TRIGGER IF EXISTS trg_exhibicion_codigo_inmutable ON exhibicion;
CREATE TRIGGER trg_exhibicion_codigo_inmutable
    BEFORE UPDATE ON exhibicion
    FOR EACH ROW EXECUTE FUNCTION trg_exhibicion_codigo_inmutable();

-- ------------------------------------------------------------
-- 4. Vista de ranking excluyendo exhibiciones inactivas.
--    Mismas columnas y orden que V3:97 (contrato de RankingExhibicionView).
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
JOIN sala s ON s.id = e.sala_id
LEFT JOIN visita v ON v.exhibicion_id = e.id AND v.valida
WHERE e.activa
GROUP BY e.id, e.codigo, e.titulo, s.id, s.nombre;

COMMENT ON VIEW v_ranking_exhibicion IS
    'Ranking de popularidad basado solo en visitas validadas por el backend; excluye exhibiciones inactivas.';

-- ------------------------------------------------------------
-- 5. Verificacion: columnas/indice/vista presentes.
-- ------------------------------------------------------------
DO $$
DECLARE
    v_columnas_extra integer;
    v_columnas_total integer;
BEGIN
    SELECT count(*) INTO v_columnas_total
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'v_ranking_exhibicion';

    SELECT count(*) INTO v_columnas_extra
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'v_ranking_exhibicion'
      AND column_name NOT IN
          ('exhibicion_id', 'codigo', 'titulo', 'sala_id', 'sala_nombre', 'total_visitas_validas');

    IF v_columnas_total <> 6 OR v_columnas_extra <> 0 THEN
        RAISE EXCEPTION 'V14: la vista v_ranking_exhibicion cambio de columnas (total=%, extra=%)',
            v_columnas_total, v_columnas_extra;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'exhibicion' AND column_name = 'version'
    ) THEN
        RAISE EXCEPTION 'V14: no se creo exhibicion.version';
    END IF;
END $$;
