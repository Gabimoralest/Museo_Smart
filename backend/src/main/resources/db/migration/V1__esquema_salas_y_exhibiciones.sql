-- ============================================================
-- Museo Smart - V1
-- Esquema base: salas, exhibiciones e historial de estado.
-- ============================================================

-- ------------------------------------------------------------
-- Funcion reutilizable de auditoria: mantiene 'actualizado_en'
-- ------------------------------------------------------------
CREATE FUNCTION set_actualizado_en() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_actualizado_en() IS
    'Asigna now() a NEW.actualizado_en en cada UPDATE. Reutilizable por todas las tablas con auditoria.';

-- ------------------------------------------------------------
-- Tabla: sala
-- El museo es exclusivamente virtual y tiene 4 salas fijas.
-- El limite de 4 se garantiza con un trigger con advisory lock.
-- ------------------------------------------------------------
CREATE TABLE sala (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre         varchar(100) NOT NULL,
    descripcion    text,
    estado         varchar(20)  NOT NULL DEFAULT 'activa',
    orden          smallint     NOT NULL,
    creado_en      timestamptz  NOT NULL DEFAULT now(),
    actualizado_en timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_sala_nombre        UNIQUE (nombre),
    CONSTRAINT uq_sala_orden         UNIQUE (orden),
    CONSTRAINT ck_sala_estado        CHECK (estado IN ('activa', 'inactiva')),
    CONSTRAINT ck_sala_orden_positivo CHECK (orden > 0)
);

COMMENT ON TABLE  sala            IS 'Salas del museo. Maximo 4, impuesto por trigger con advisory lock.';
COMMENT ON COLUMN sala.orden      IS 'Orden de presentacion; unico y positivo.';
COMMENT ON COLUMN sala.estado     IS 'Estado logico de la sala (activa/inactiva).';

CREATE TRIGGER trg_sala_actualizado_en
    BEFORE UPDATE ON sala
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

-- Limite de 4 salas, seguro ante inserciones concurrentes.
-- Se serializa mediante un pg_advisory_xact_lock de clave fija: la comprobacion
-- COUNT(*) y la insercion quedan dentro del mismo bloqueo hasta el fin de la
-- transaccion, evitando condiciones de carrera. El lock se libera solo al
-- confirmar o revertir la transaccion (xact = transaction scoped).
CREATE FUNCTION trg_sala_limite() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_count integer;
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM pg_advisory_xact_lock(hashtext('museo_smart.sala.limite'));
        SELECT count(*) INTO v_count FROM sala;
        IF v_count >= 4 THEN
            RAISE EXCEPTION 'No se pueden crear mas de 4 salas (existen %)', v_count
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_sala_limite() IS
    'Impide insertar una quinta sala. Usa advisory lock transaccional para soportar concurrencia.';

CREATE TRIGGER trg_sala_limite
    BEFORE INSERT ON sala
    FOR EACH ROW EXECUTE FUNCTION trg_sala_limite();

-- ------------------------------------------------------------
-- Tabla: exhibicion
-- Cada sala tendra exactamente 2 exhibiciones iniciales (limite por trigger).
-- Los limites ambientales son configurables y admiten NULL.
-- ------------------------------------------------------------
CREATE TABLE exhibicion (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sala_id              bigint       NOT NULL REFERENCES sala(id) ON DELETE RESTRICT,
    codigo               varchar(30)  NOT NULL,
    titulo               varchar(200) NOT NULL,
    descripcion          text,
    contexto_historico   text,
    autor_cultura        varchar(200),
    periodo              varchar(150),
    material             varchar(200),
    fecha_creacion_aprox text,
    temp_min_c           numeric(5,2),
    temp_max_c           numeric(5,2),
    humedad_min_pct      numeric(5,2),
    humedad_max_pct      numeric(5,2),
    luz_max_lux          numeric(7,2),
    activa               boolean      NOT NULL DEFAULT true,
    creado_en            timestamptz  NOT NULL DEFAULT now(),
    actualizado_en       timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_exhibicion_codigo          UNIQUE (codigo),
    CONSTRAINT ck_exhibicion_temp_rango      CHECK (temp_min_c IS NULL OR temp_max_c IS NULL OR temp_min_c <= temp_max_c),
    CONSTRAINT ck_exhibicion_humedad_rango   CHECK (humedad_min_pct IS NULL OR humedad_max_pct IS NULL OR humedad_min_pct <= humedad_max_pct),
    CONSTRAINT ck_exhibicion_temp_min        CHECK (temp_min_c IS NULL OR temp_min_c BETWEEN -100 AND 100),
    CONSTRAINT ck_exhibicion_temp_max        CHECK (temp_max_c IS NULL OR temp_max_c BETWEEN -100 AND 100),
    CONSTRAINT ck_exhibicion_humedad_min     CHECK (humedad_min_pct IS NULL OR humedad_min_pct BETWEEN 0 AND 100),
    CONSTRAINT ck_exhibicion_humedad_max     CHECK (humedad_max_pct IS NULL OR humedad_max_pct BETWEEN 0 AND 100),
    CONSTRAINT ck_exhibicion_luz_max         CHECK (luz_max_lux IS NULL OR luz_max_lux >= 0)
);

COMMENT ON TABLE  exhibicion                    IS 'Exhibiciones del museo. Exactamente 2 por sala, impuesto por trigger.';
COMMENT ON COLUMN exhibicion.codigo             IS 'Codigo estable y unico usado en URLs y referencias externas.';
COMMENT ON COLUMN exhibicion.fecha_creacion_aprox IS 'Fecha aproximada en texto libre (p. ej. "Siglo XVIII"); NULL si se desconoce.';
COMMENT ON COLUMN exhibicion.activa             IS 'Estado logico; al cambiar se registra en exhibicion_estado_historial.';
COMMENT ON COLUMN exhibicion.temp_min_c         IS 'Limite ambiental inferior configurable; NULL si no se conoce.';
COMMENT ON COLUMN exhibicion.temp_max_c         IS 'Limite ambiental superior configurable; NULL si no se conoce.';

CREATE INDEX idx_exhibicion_sala   ON exhibicion (sala_id);
CREATE INDEX idx_exhibicion_activa ON exhibicion (activa);

CREATE TRIGGER trg_exhibicion_actualizado_en
    BEFORE UPDATE ON exhibicion
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

-- Limite de 2 exhibiciones por sala, seguro ante concurrencia.
-- En INSERT se bloquea por sala destino. En UPDATE que cambia de sala se
-- bloquean ambas salas en orden creciente de id para evitar deadlocks.
-- Ademas se comprueba la sala destino (la de origen solo disminuye su conteo).
CREATE FUNCTION trg_exhibicion_limite_sala() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_count integer;
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM pg_advisory_xact_lock(hashtext('museo_smart.exhibicion.sala:' || NEW.sala_id::text));
        SELECT count(*) INTO v_count FROM exhibicion WHERE sala_id = NEW.sala_id;
        IF v_count >= 2 THEN
            RAISE EXCEPTION 'La sala % ya tiene el maximo de 2 exhibiciones', NEW.sala_id
                USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.sala_id IS DISTINCT FROM OLD.sala_id THEN
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
    'Impide mas de 2 exhibiciones por sala y cambios de sala que violen el limite. Advisory locks para concurrencia.';

CREATE TRIGGER trg_exhibicion_limite_sala
    BEFORE INSERT OR UPDATE ON exhibicion
    FOR EACH ROW EXECUTE FUNCTION trg_exhibicion_limite_sala();

-- ------------------------------------------------------------
-- Tabla: exhibicion_estado_historial
-- Conserva el historial de activacion/desactivacion. La FK a usuario_admin
-- se agrega en V2 (la tabla de usuarios aun no existe en esta migracion).
-- ------------------------------------------------------------
CREATE TABLE exhibicion_estado_historial (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    exhibicion_id   bigint      NOT NULL REFERENCES exhibicion(id) ON DELETE RESTRICT,
    estado_anterior boolean     NOT NULL,
    estado_nuevo    boolean     NOT NULL,
    motivo          text,
    cambiado_por    bigint,
    cambiado_en     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_historial_cambio CHECK (estado_anterior IS DISTINCT FROM estado_nuevo)
);

COMMENT ON TABLE  exhibicion_estado_historial          IS 'Historial de cambios de estado activo/inactivo de las exhibiciones.';
COMMENT ON COLUMN exhibicion_estado_historial.cambiado_por IS 'Usuario responsable; FK a usuario_admin se agrega en V2.';

CREATE INDEX idx_historial_exhibicion ON exhibicion_estado_historial (exhibicion_id);

-- Registra automaticamente cada transicion del campo 'activa'.
-- El usuario y el motivo (opcionales) se toman de variables de sesion que el
-- backend podra fijar con set_config('museo_smart.usuario_admin_id', ...).
CREATE FUNCTION trg_exhibicion_historial() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_usuario bigint;
    v_motivo  text;
BEGIN
    IF NEW.activa IS DISTINCT FROM OLD.activa THEN
        BEGIN
            v_usuario := nullif(current_setting('museo_smart.usuario_admin_id', true), '')::bigint;
        EXCEPTION WHEN others THEN
            v_usuario := NULL;
        END;
        v_motivo := nullif(current_setting('museo_smart.motivo_estado', true), '');
        INSERT INTO exhibicion_estado_historial
            (exhibicion_id, estado_anterior, estado_nuevo, motivo, cambiado_por)
        VALUES
            (OLD.id, OLD.activa, NEW.activa, v_motivo, v_usuario);
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_exhibicion_historial() IS
    'Tras cada UPDATE de exhibicion.activa inserta una fila de historial.';

CREATE TRIGGER trg_exhibicion_historial
    AFTER UPDATE ON exhibicion
    FOR EACH ROW EXECUTE FUNCTION trg_exhibicion_historial();
