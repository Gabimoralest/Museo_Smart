-- ============================================================
-- Museo Smart - V7
-- Ubicacion correcta de los sensores simulados por Node-RED.
--
-- Distribucion fisica (12 sensores):
--   - 4 sensores AMBIENTALES: uno por sala. Cada uno es un unico
--     dispositivo que reporta temperatura, humedad y luminosidad.
--     Se representa con tipo = 'MULTI' (no se crean tres sensores).
--   - 8 sensores de PRESENCIA: uno por exhibicion.
--
-- Migracion ADITIVA: no modifica V1-V6. La tabla sensor esta vacia en
-- el entorno de desarrollo, por lo que el cambio de CHECK no afecta datos.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Nueva FK a sala. Un sensor AMBIENTAL pertenece a una sala;
--    uno de PRESENCIA a una exhibicion. Never both.
-- ------------------------------------------------------------
ALTER TABLE sensor
    ADD COLUMN sala_id bigint REFERENCES sala(id) ON DELETE RESTRICT;

-- ------------------------------------------------------------
-- 2. exhibicion_id deja de ser obligatorio (nullable) para permitir
--    sensores ambientales ligados a sala.
-- ------------------------------------------------------------
ALTER TABLE sensor
    ALTER COLUMN exhibicion_id DROP NOT NULL;

-- ------------------------------------------------------------
-- 3. tipo: se anade 'MULTI' para el sensor ambiental multidimensional.
--    Los tipos por metrica (TEMPERATURA/HUMEDAD/LUZ/CO2) se retiran de
--    sensor: las metricas concretas se registran en medicion_pendiente,
--    no como dispositivos separados. Ninguna logica Java depende del
--    CHECK anterior (no existe entidad/repositorio Sensor).
-- ------------------------------------------------------------
ALTER TABLE sensor DROP CONSTRAINT ck_sensor_tipo;
ALTER TABLE sensor
    ADD CONSTRAINT ck_sensor_tipo CHECK (tipo IN ('PRESENCIA', 'MULTI'));

-- ------------------------------------------------------------
-- 4. Coherencia entre categoria y ubicacion:
--    - AMBIENTAL: sala_id obligatorio y exhibicion_id NULL.
--    - PRESENCIA: exhibicion_id obligatorio y sala_id NULL.
-- ------------------------------------------------------------
ALTER TABLE sensor
    ADD CONSTRAINT ck_sensor_ubicacion CHECK (
        (categoria = 'AMBIENTAL' AND sala_id IS NOT NULL AND exhibicion_id IS NULL)
        OR
        (categoria = 'PRESENCIA' AND exhibicion_id IS NOT NULL AND sala_id IS NULL)
    );

-- ------------------------------------------------------------
-- 5. Coherencia entre categoria y tipo:
--    - AMBIENTAL -> MULTI (un dispositivo, varias metricas).
--    - PRESENCIA -> PRESENCIA.
-- ------------------------------------------------------------
ALTER TABLE sensor
    ADD CONSTRAINT ck_sensor_categoria_tipo CHECK (
        (categoria = 'AMBIENTAL' AND tipo = 'MULTI')
        OR
        (categoria = 'PRESENCIA' AND tipo = 'PRESENCIA')
    );

-- ------------------------------------------------------------
-- 6. Indice para la nueva FK. No se recrean los indices existentes
--    (idx_sensor_exhibicion, idx_sensor_estado, idx_sensor_tipo).
-- ------------------------------------------------------------
CREATE INDEX idx_sensor_sala ON sensor (sala_id);

-- ------------------------------------------------------------
-- 7. Comentarios actualizados al nuevo modelo.
-- ------------------------------------------------------------
COMMENT ON TABLE  sensor IS
    'Sensores fisicos/simulados. 4 ambientales (uno por sala, tipo MULTI) y 8 de presencia (uno por exhibicion).';
COMMENT ON COLUMN sensor.sala_id IS
    'Sala asociada; obligatoria para categoria AMBIENTAL y NULL para PRESENCIA.';
COMMENT ON COLUMN sensor.exhibicion_id IS
    'Exhibicion asociada; obligatoria para categoria PRESENCIA y NULL para AMBIENTAL.';
COMMENT ON COLUMN sensor.tipo IS
    'PRESENCIA (sensor de presencia) o MULTI (ambiental con temperatura, humedad y luminosidad).';
COMMENT ON COLUMN sensor.categoria IS
    'PRESENCIA o AMBIENTAL; determina la ubicacion (exhibicion o sala).';
