package com.museosmart.repository.redis;

import java.time.OffsetDateTime;

/**
 * Resumen ambiental actual de una sala, leido desde Redis.
 *
 * <p>Refleja los valores del sensor ambiental de la sala en su ultima lectura.
 * TTL de 5 minutos, igual que el estado del sensor del que se deriva.</p>
 */
public record EstadoSalaRedis(
        Long salaId,
        String sensorCodigo,
        Double temperatura,
        Double humedad,
        Double luminosidad,
        OffsetDateTime actualizadoEn) {
}
