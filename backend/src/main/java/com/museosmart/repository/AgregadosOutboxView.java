package com.museosmart.repository;

/**
 * Proyección de solo lectura con agregados de reintentos y errores del outbox.
 * No expone el contenido de {@code ultimo_error} (podría contener detalles
 * internos), solo recuentos.
 */
public interface AgregadosOutboxView {

    long getIntentosTotales();

    long getMaxIntentos();

    long getTotalError();

    long getConReintentoProgramado();
}
