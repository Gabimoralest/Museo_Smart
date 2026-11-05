package com.museosmart.repository.redis;

import java.time.OffsetDateTime;

/**
 * Estado actual de un sensor leido desde Redis.
 *
 * <p>Representa la ultima lectura conocida del dispositivo. Caduca a los
 * 5 minutos: si el sensor deja de enviar, su estado desaparece y el panel lo
 * muestra como "sin datos recientes". PostgreSQL sigue siendo la fuente de
 * verdad historica.</p>
 */
public record EstadoSensorRedis(
        Long sensorId,
        String sensorCodigo,
        String categoria,
        Long salaId,
        Long exhibicionId,
        Double temperatura,
        Double humedad,
        Double luminosidad,
        Boolean presencia,
        String estadoTemperatura,
        String estadoHumedad,
        String estadoLuz,
        String estadoPresencia,
        OffsetDateTime actualizadoEn) {
}
