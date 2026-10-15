-- ============================================================
-- Museo Smart - V10
-- Estado de presencia actual por sensor de PRESENCIA.
--
-- Contexto: la ingestion MQTT de presencia (museo/sensores/presencia)
-- registra una medicion por cada lectura periodica (cada 5 s en el
-- simulador). Para que cada episodio real de presencia cuente como UNA
-- sola visita en el ranking de popularidad, el backend necesita recordar
-- el ultimo estado observado por sensor y detectar el flanco de subida
-- (false/null -> true). Sin ese estado persistente, la unica deduplicacion
-- disponible (uq_visita_dedup, ventana de 1 minuto) contaria una visita por
-- minuto mientras la presencia siguiera activa.
--
-- Esta migracion es ADITIVA: no modifica V1-V9 ni el esquema previo.
--   - NULL  = aun sin lectura de presencia (estado desconocido).
--   - true  = ultima lectura con presencia.
--   - false = ultima lectura sin presencia.
--
-- No se rellena ningun dato: los sensores existentes quedan con NULL y la
-- primera lectura establecera el estado.
-- ============================================================

ALTER TABLE sensor
    ADD COLUMN presencia_actual boolean;

COMMENT ON COLUMN sensor.presencia_actual IS
    'Ultimo estado de presencia observado por un sensor de categoria PRESENCIA (NULL = sin lectura). Permite detectar el flanco de subida y contabilizar una visita por episodio de presencia.';
