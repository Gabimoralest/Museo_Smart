-- ============================================================
-- Museo Smart - V4
-- Sensores, alertas, integracion IoT y outbox de mediciones.
-- Depende de V1 (exhibicion).
-- ============================================================

-- ------------------------------------------------------------
-- Tabla: sensor
-- Se asocia SIEMPRE a una exhibicion, nunca a una sala.
-- ------------------------------------------------------------
CREATE TABLE sensor (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo         varchar(80) NOT NULL,
    tipo           varchar(30) NOT NULL,
    categoria      varchar(20) NOT NULL,
    exhibicion_id  bigint      NOT NULL REFERENCES exhibicion(id) ON DELETE RESTRICT,
    estado         varchar(20) NOT NULL DEFAULT 'ACTIVO',
    unidad         varchar(20),
    descripcion    text,
    instalado_en   timestamptz,
    creado_en      timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_sensor_codigo    UNIQUE (codigo),
    CONSTRAINT ck_sensor_tipo      CHECK (tipo IN ('PRESENCIA', 'TEMPERATURA', 'HUMEDAD', 'LUZ', 'CO2')),
    CONSTRAINT ck_sensor_categoria CHECK (categoria IN ('PRESENCIA', 'AMBIENTAL')),
    CONSTRAINT ck_sensor_estado    CHECK (estado IN ('ACTIVO', 'INACTIVO', 'MANTENIMIENTO'))
);

COMMENT ON TABLE  sensor              IS 'Sensores fisicos/simulados asociados a una exhibicion.';
COMMENT ON COLUMN sensor.codigo       IS 'Codigo unico del dispositivo (coincide con el que publica Node-RED).';
COMMENT ON COLUMN sensor.categoria    IS 'PRESENCIA o AMBIENTAL; agrupa tipos con tratamiento distinto.';

CREATE INDEX idx_sensor_exhibicion ON sensor (exhibicion_id);
CREATE INDEX idx_sensor_estado     ON sensor (estado);
CREATE INDEX idx_sensor_tipo       ON sensor (tipo);

CREATE TRIGGER trg_sensor_actualizado_en
    BEFORE UPDATE ON sensor
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

-- ------------------------------------------------------------
-- Tabla: alerta
-- ------------------------------------------------------------
CREATE TABLE alerta (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sensor_id       bigint REFERENCES sensor(id) ON DELETE SET NULL,
    tipo            varchar(20) NOT NULL,
    severidad       varchar(20) NOT NULL,
    estado          varchar(20) NOT NULL DEFAULT 'ABIERTA',
    descripcion     text        NOT NULL,
    condicion_clave varchar(160) NOT NULL,
    iniciada_en     timestamptz NOT NULL DEFAULT now(),
    resuelta_en     timestamptz,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    actualizado_en  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_alerta_tipo      CHECK (tipo IN ('PRESENCIA', 'AMBIENTAL', 'SISTEMA', 'INTEGRACION')),
    CONSTRAINT ck_alerta_severidad CHECK (severidad IN ('INFO', 'ADVERTENCIA', 'CRITICA')),
    CONSTRAINT ck_alerta_estado    CHECK (estado IN ('ABIERTA', 'RECONOCIDA', 'RESUELTA', 'CERRADA'))
);

COMMENT ON TABLE  alerta                 IS 'Alertas del sistema. Deduplicadas por condicion mientras siguen abiertas.';
COMMENT ON COLUMN alerta.condicion_clave IS 'Clave estable de la condicion; evita duplicar alertas de una condicion persistente.';

CREATE INDEX idx_alerta_estado    ON alerta (estado);
CREATE INDEX idx_alerta_severidad ON alerta (severidad);
CREATE INDEX idx_alerta_sensor    ON alerta (sensor_id);

CREATE TRIGGER trg_alerta_actualizado_en
    BEFORE UPDATE ON alerta
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

-- Una condicion persistente genera una sola alerta mientras este ABIERTA o
-- RECONOCIDA. Al pasar a RESUELTA/CERRADA puede crearse de nuevo si reaparece.
CREATE UNIQUE INDEX uq_alerta_condicion_activa
    ON alerta (sensor_id, condicion_clave)
    WHERE estado IN ('ABIERTA', 'RECONOCIDA');

-- ------------------------------------------------------------
-- Tabla: mensaje_iot
-- Entrada cruda de MQTT + idempotencia + trazabilidad de errores.
-- ------------------------------------------------------------
CREATE TABLE mensaje_iot (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mensaje_id           uuid        NOT NULL,
    topico               varchar(255) NOT NULL,
    payload              jsonb       NOT NULL,
    sensor_codigo        varchar(80),
    estado_procesamiento varchar(20) NOT NULL DEFAULT 'RECIBIDO',
    error                text,
    recibido_en          timestamptz NOT NULL DEFAULT now(),
    procesado_en         timestamptz,
    CONSTRAINT uq_mensaje_iot_mensaje_id UNIQUE (mensaje_id),
    CONSTRAINT ck_mensaje_iot_estado CHECK (estado_procesamiento IN ('RECIBIDO', 'PROCESADO', 'ERROR', 'IGNORADO'))
);

COMMENT ON TABLE  mensaje_iot               IS 'Mensajes MQTT recibidos. mensaje_id unico garantiza idempotencia.';
COMMENT ON COLUMN mensaje_iot.estado_procesamiento IS 'RECIBIDO no implica PROCESADO; el backend lo marca tras validar.';

CREATE INDEX idx_mensaje_iot_estado   ON mensaje_iot (estado_procesamiento);
CREATE INDEX idx_mensaje_iot_sensor   ON mensaje_iot (sensor_codigo);
CREATE INDEX idx_mensaje_iot_recibido ON mensaje_iot (recibido_en);

-- ------------------------------------------------------------
-- Tabla: medicion_pendiente (outbox persistente hacia InfluxDB)
-- Sobrevive al reinicio: vive en PostgreSQL. Referencia real al mensaje origen.
-- ------------------------------------------------------------
CREATE TABLE medicion_pendiente (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mensaje_iot_id     bigint       NOT NULL REFERENCES mensaje_iot(id) ON DELETE RESTRICT,
    sensor_id          bigint REFERENCES sensor(id) ON DELETE SET NULL,
    metrica            varchar(40)  NOT NULL,
    valor              numeric      NOT NULL,
    unidad             varchar(20),
    medido_en          timestamptz  NOT NULL,
    estado             varchar(20)  NOT NULL DEFAULT 'PENDIENTE',
    intentos           integer      NOT NULL DEFAULT 0,
    proximo_intento_en timestamptz,
    ultimo_error       text,
    enviado_en         timestamptz,
    creado_en          timestamptz  NOT NULL DEFAULT now(),
    actualizado_en     timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_medicion_metrica CHECK (metrica IN ('PRESENCIA', 'TEMPERATURA', 'HUMEDAD', 'LUZ', 'CO2')),
    CONSTRAINT ck_medicion_estado  CHECK (estado IN ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'ERROR')),
    CONSTRAINT ck_medicion_intentos CHECK (intentos >= 0)
);

COMMENT ON TABLE  medicion_pendiente IS 'Outbox durable hacia InfluxDB. Persiste en PostgreSQL y soporta reintentos.';
COMMENT ON COLUMN medicion_pendiente.mensaje_iot_id IS 'FK real al mensaje de origen; garantiza trazabilidad.';
COMMENT ON COLUMN medicion_pendiente.estado IS 'PENDIENTE/ENVIANDO para reintento; ENVIADO apto para purga por retencion.';

-- Idempotencia: un mensaje no genera dos mediciones de la misma metrica.
CREATE UNIQUE INDEX uq_medicion_mensaje_metrica
    ON medicion_pendiente (mensaje_iot_id, metrica);

-- Barrido eficiente de reintentos.
CREATE INDEX idx_medicion_estado_proximo ON medicion_pendiente (estado, proximo_intento_en);
CREATE INDEX idx_medicion_sensor         ON medicion_pendiente (sensor_id);
CREATE INDEX idx_medicion_medido_en      ON medicion_pendiente (medido_en);

CREATE TRIGGER trg_medicion_actualizado_en
    BEFORE UPDATE ON medicion_pendiente
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
