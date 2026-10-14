package com.museosmart.iot.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Payload del topico de presencia {@code museo/sensores/presencia}.
 *
 * <p>Un sensor de presencia pertenece a una unica exhibicion.
 * {@code exhibicionId} debe corresponder a la exhibicion asociada al sensor.</p>
 */
public record MensajePresenciaDto(
        @JsonProperty("mensajeId") UUID mensajeId,
        @JsonProperty("sensorCodigo") String sensorCodigo,
        @JsonProperty("exhibicionId") Long exhibicionId,
        @JsonProperty("presencia") Boolean presencia,
        @JsonProperty("timestamp") OffsetDateTime timestamp
) {
}
