-- ============================================================
-- Museo Smart - V3
-- Contenido multimedia y visitas/interacciones de visitantes.
-- Depende de V1 (exhibicion).
-- ============================================================

-- ------------------------------------------------------------
-- Tabla: contenido_multimedia
-- Solo metadatos y URL de ImageKit; nunca el binario.
-- ------------------------------------------------------------
CREATE TABLE contenido_multimedia (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exhibicion_id  bigint        NOT NULL REFERENCES exhibicion(id) ON DELETE CASCADE,
    imagekit_id    varchar(128)  NOT NULL,
    tipo           varchar(20)   NOT NULL,
    url            varchar(1024) NOT NULL,
    url_thumbnail  varchar(1024),
    descripcion    text,
    es_principal   boolean       NOT NULL DEFAULT false,
    orden          smallint      NOT NULL DEFAULT 0,
    metadatos      jsonb,
    creado_en      timestamptz   NOT NULL DEFAULT now(),
    actualizado_en timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT uq_multimedia_imagekit_id UNIQUE (imagekit_id),
    CONSTRAINT ck_multimedia_tipo        CHECK (tipo IN ('IMAGEN', 'VIDEO')),
    CONSTRAINT ck_multimedia_orden       CHECK (orden >= 0)
);

COMMENT ON TABLE  contenido_multimedia            IS 'Metadatos de recursos multimedia alojados en ImageKit. No se guardan binarios.';
COMMENT ON COLUMN contenido_multimedia.imagekit_id IS 'Identificador unico del recurso en ImageKit.';
COMMENT ON COLUMN contenido_multimedia.metadatos   IS 'Dimensiones, duracion, mime, etc.';

CREATE INDEX idx_multimedia_exhibicion ON contenido_multimedia (exhibicion_id);

-- Como maximo un recurso principal por exhibicion.
CREATE UNIQUE INDEX uq_multimedia_principal_por_exhibicion
    ON contenido_multimedia (exhibicion_id)
    WHERE es_principal;

CREATE TRIGGER trg_multimedia_actualizado_en
    BEFORE UPDATE ON contenido_multimedia
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

-- ------------------------------------------------------------
-- Tabla: visita
-- Interacciones de visitantes anonimos. Deduplicacion por ventana temporal.
-- 'valida' la determina el backend, nunca el frontend.
-- ------------------------------------------------------------
CREATE TABLE visita (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exhibicion_id     bigint      NOT NULL REFERENCES exhibicion(id) ON DELETE RESTRICT,
    sesion_anonima_id uuid        NOT NULL,
    fuente            varchar(20) NOT NULL,
    ocurrido_en       timestamptz NOT NULL DEFAULT now(),
    ventana_inicio    timestamptz NOT NULL,
    valida            boolean     NOT NULL DEFAULT false,
    motivo_invalida   varchar(120),
    validada_en       timestamptz,
    registrado_en     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_visita_fuente CHECK (fuente IN ('CURSOR', 'SIMULADOR', 'SENSOR', 'QR', 'OTRO'))
);

COMMENT ON TABLE  visita                 IS 'Interacciones de visitantes. El backend valida antes de contar en el ranking.';
COMMENT ON COLUMN visita.ventana_inicio  IS 'Bucket temporal (minuto) calculado por trigger para deduplicar movimientos.';
COMMENT ON COLUMN visita.valida          IS 'La fija el backend; el valor enviado por el frontend se ignora.';

CREATE INDEX idx_visita_exhibicion ON visita (exhibicion_id);
CREATE INDEX idx_visita_valida     ON visita (valida);
CREATE INDEX idx_visita_ocurrido   ON visita (ocurrido_en);

-- Deduplicacion: agrupa en buckets de 1 minuto y evita filas repetidas del
-- mismo visitante, exhibicion y fuente en el mismo minuto. Asi, N movimientos
-- de cursor seguidos cuentan como una sola interaccion candidata.
CREATE FUNCTION trg_visita_ventana() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.ventana_inicio := date_trunc('minute', NEW.ocurrido_en);
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_visita_ventana() IS
    'Calcula ventana_inicio (bucket de 1 minuto) antes de insertar una visita.';

CREATE TRIGGER trg_visita_ventana
    BEFORE INSERT ON visita
    FOR EACH ROW EXECUTE FUNCTION trg_visita_ventana();

CREATE UNIQUE INDEX uq_visita_dedup
    ON visita (exhibicion_id, sesion_anonima_id, fuente, ventana_inicio);

-- ------------------------------------------------------------
-- Vista: v_ranking_exhibicion
-- Ranking por visitas VALIDAS, sin duplicar informacion: se calcula al vuelo
-- sobre la tabla visita. Solo se conserva el historico en 'visita'.
-- ------------------------------------------------------------
CREATE VIEW v_ranking_exhibicion AS
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
GROUP BY e.id, e.codigo, e.titulo, s.id, s.nombre;

COMMENT ON VIEW v_ranking_exhibicion IS
    'Ranking de popularidad basado solo en visitas validadas por el backend.';
