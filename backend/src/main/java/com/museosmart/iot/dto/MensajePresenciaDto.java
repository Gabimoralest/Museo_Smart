package com.museosmart.iot.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Payload del topico de presencia {@code museo/sensores/presencia}.
 *
 * <p>Un sensor de presencia pertenece a una unica exhibicion. La identidad
 * del sensor es su {@code sensorCodigo}; la exhibicion se toma del sensor en
 * la base. {@code exhibicionId} es opcional: si viene debe coincidir con la
 * exhibicion real del sensor.</p>
 */
public record MensajePresenciaDto(
        @JsonProperty("mensajeId") UUID mensajeId,
        @JsonProperty("sensorCodigo") String sensorCodigo,
        @JsonProperty("exhibicionId") Long exhibicionId,
        @JsonProperty("presencia") Boolean presencia,
        @JsonProperty("timestamp") OffsetDateTime timestamp
) {
}
