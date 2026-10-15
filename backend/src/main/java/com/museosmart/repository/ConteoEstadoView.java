package com.museosmart.repository;

/**
 * Proyección de solo lectura: número de mediciones del outbox por estado.
 */
public interface ConteoEstadoView {

    String getEstado();

    long getTotal();
}
