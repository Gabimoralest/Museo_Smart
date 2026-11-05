package com.museosmart.repository.redis;

/**
 * Nombres y TTL de las claves de Redis usadas por Museo_Smart.
 *
 * <p>Redis es una capa de ESTADO ACTUAL (no fuente de verdad). PostgreSQL
 * conserva los datos permanentes y el historico; InfluxDB el historico de
 * mediciones. Ver {@code docs/01-manual-tecnico.md} (Arquitectura de datos).</p>
 */
public final class RedisClaves {

    /** Hash con el ultimo estado de un sensor. TTL: 5 minutos. */
    public static final String PREFIJO_SENSOR = "museo:sensor:";

    /** Hash con el resumen ambiental actual de una sala. TTL: 5 minutos. */
    public static final String PREFIJO_SALA = "museo:sala:";

    /** Hash con la presencia actual de una exhibicion. TTL: 5 minutos. */
    public static final String PREFIJO_EXHIBICION_PRESENCIA = "museo:exhibicion:";

    /** Sufijo del hash de presencia por exhibicion. */
    public static final String SUFIJO_PRESENCIA = ":presencia";

    /**
     * Conjunto de codigos de sensor con estado vigente. Permite listar sin SCAN.
     * Se refresca en cada escritura y expira 15 min despues de la ultima, de modo
     * que los sensores que dejan de enviar desaparecen tambien del indice.
     */
    public static final String INDICE_SENSORES = "museo:sensores:indice";

    /** Conjunto de ids de alertas ABIERTA/RECONOCIDA. Sin TTL (se mantiene al crear/resolver). */
    public static final String ALERTAS_ABIERTAS = "museo:alertas:abiertas";

    private RedisClaves() {
    }

    public static String sensor(String codigo) {
        return PREFIJO_SENSOR + codigo;
    }

    public static String sala(Long salaId) {
        return PREFIJO_SALA + salaId;
    }

    public static String presenciaExhibicion(Long exhibicionId) {
        return PREFIJO_EXHIBICION_PRESENCIA + exhibicionId + SUFIJO_PRESENCIA;
    }
}
