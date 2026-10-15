package com.museosmart.repository;

import java.math.BigDecimal;

/**
 * Proyección de solo lectura: promedio de {@code valor} por {@code metrica}
 * sobre las lecturas dentro de una ventana temporal.
 */
public interface PromedioMetricaView {

    String getMetrica();

    BigDecimal getPromedio();

    String getUnidad();

    long getTotal();
}
