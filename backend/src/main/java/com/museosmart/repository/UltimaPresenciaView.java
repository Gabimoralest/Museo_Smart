package com.museosmart.repository;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Proyección de solo lectura de la última medición de presencia por sensor.
 * El valor es 1 (hay presencia) o 0 (sin presencia).
 */
public interface UltimaPresenciaView {

    Long getSensorId();

    BigDecimal getValor();

    // Ver nota en UltimaLecturaView: la consulta nativa devuelve Instant.
    Instant getMedidoEn();
}
