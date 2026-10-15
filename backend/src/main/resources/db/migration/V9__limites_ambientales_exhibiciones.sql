-- ============================================================
-- Museo Smart - V9
-- Limites ambientales iniciales de las 8 exhibiciones provisionales.
--
-- Contexto: V1 definio las columnas de limites como NULL a proposito
-- (se desconocian). Hasta ahora, AlertaService.evaluarAmbiental no tenia
-- nada que evaluar y por eso no se generaba ninguna alerta ambiental.
--
-- Esta migracion ADITIVA rellena esos limites con valores iniciales
-- justificables por el tipo de material de cada sala. NO modifica
-- migraciones previas ni el esquema. Valores basados en pautas de
-- conservacion ampliamente usadas en museos (ICOM-CC / CCI):
--
--   Pintura historica    -> T 18-22 C, HR 45-55 %, luz <= 150 lx
--       (lienzo/madera: la luz produce dano fotoquimico y la HR fuera de
--        banda provoca craquelado y deformacion del soporte).
--   Ceramica y artesania -> T 18-26 C, HR 35-65 %, luz <= 300 lx
--       (ceramica cocida y artefactos robustos: toleran bandas mas amplias).
--   Patrimonio cultural  -> T 18-24 C, HR 40-60 %, luz <= 200 lx
--       (patrimonio mixto: documentos, textiles y metales moderadamente
--        sensibles).
--   Historia natural     -> T 18-24 C, HR 40-60 %, luz <= 150 lx
--       (taxidermia/herbario: muy sensibles a la radiacion luminica).
--
-- Coherencia con el simulador Node-RED (rangos que publica):
--   temperatura 18-30 C, humedad 30-70 %, luminosidad 100-500 lx.
--   Como el simulador puede salir de estas bandas de conservacion, el
--   sistema generara alertas reales; es el comportamiento esperado y
--   demuestra la deduplicacion de AlertaService.
--
-- Idempotente y no destructivo: rellena CADA columna solo si sigue en NULL
-- (COALESCE), por lo que nunca sobrescribe limites ya configurados. Asi una
-- exhibicion parcialmente configurada se completa sin perder lo existente.
-- Una verificacion final aborta si alguna columna quedara incompleta.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Limites por sala (ambas exhibiciones de la sala comparten banda).
--    COALESCE respeta cualquier valor ya presente; solo completa NULL.
-- ------------------------------------------------------------
UPDATE exhibicion e
SET temp_min_c      = COALESCE(e.temp_min_c,      v.temp_min_c),
    temp_max_c      = COALESCE(e.temp_max_c,      v.temp_max_c),
    humedad_min_pct = COALESCE(e.humedad_min_pct, v.humedad_min_pct),
    humedad_max_pct = COALESCE(e.humedad_max_pct, v.humedad_max_pct),
    luz_max_lux     = COALESCE(e.luz_max_lux,     v.luz_max_lux)
FROM (VALUES
    ('Pintura histórica',    18.00, 22.00, 45.00, 55.00, 150.00),
    ('Cerámica y artesanía', 18.00, 26.00, 35.00, 65.00, 300.00),
    ('Patrimonio cultural',  18.00, 24.00, 40.00, 60.00, 200.00),
    ('Historia natural',     18.00, 24.00, 40.00, 60.00, 150.00)
) AS v(sala_nombre, temp_min_c, temp_max_c, humedad_min_pct, humedad_max_pct, luz_max_lux)
JOIN sala s ON s.nombre = v.sala_nombre
WHERE e.sala_id = s.id;

-- ------------------------------------------------------------
-- 2. Verificacion final: las 8 exhibiciones deben tener una banda
--    completa y coherente (min <= max, rangos fisicos validos). Si algo
--    no cuadra, se aborta la migracion con un mensaje explicito.
-- ------------------------------------------------------------
DO $$
DECLARE
    v_problemas text;
    v_incompletas integer;
BEGIN
    SELECT count(*)
      INTO v_incompletas
    FROM exhibicion
    WHERE temp_min_c IS NULL OR temp_max_c IS NULL
       OR humedad_min_pct IS NULL OR humedad_max_pct IS NULL
       OR luz_max_lux IS NULL;

    IF v_incompletas > 0 THEN
        RAISE EXCEPTION 'V9: % exhibiciones siguen con limites incompletos', v_incompletas;
    END IF;

    SELECT string_agg(
               format('%s [T %s..%s, HR %s..%s, luz<=%s]',
                      e.codigo,
                      e.temp_min_c, e.temp_max_c,
                      e.humedad_min_pct, e.humedad_max_pct,
                      e.luz_max_lux),
               '; ' ORDER BY e.id)
      INTO v_problemas
    FROM exhibicion e
    WHERE e.temp_min_c > e.temp_max_c
       OR e.humedad_min_pct > e.humedad_max_pct
       OR e.temp_min_c < -100 OR e.temp_max_c > 100
       OR e.humedad_min_pct < 0 OR e.humedad_max_pct > 100
       OR e.luz_max_lux < 0;

    IF v_problemas IS NOT NULL THEN
        RAISE EXCEPTION 'V9: limites fuera de rango o incoherentes: %', v_problemas;
    END IF;
END $$;
