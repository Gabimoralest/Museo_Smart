package com.museosmart.repository;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Proyección de solo lectura de la última medición conocida por
 * (sensor, métrica), tomada de {@code medicion_pendiente}.
 *
 * <p>El estado del outbox ({@code estado}) describe el envío hacia InfluxDB, no
 * la validez de la lectura: todas las filas persistidas superaron la validación
 * de la ingesta. Sirve para trazabilidad, no para descartar datos.</p>
 */
public interface UltimaLecturaView {

    Long getSensorId();

    String getMetrica();

    BigDecimal getValor();

    String getUnidad();

    // La consulta nativa devuelve timestamptz como java.time.Instant; declararlo
    // así evita el UnsupportedOperationException de proyección Instant->OffsetDateTime.
    Instant getMedidoEn();

    String getEstado();
}
