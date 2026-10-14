package com.museosmart.iot.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Payload del topico ambiental {@code museo/sensores/ambiental}.
 *
 * <p>Un sensor ambiental es un unico dispositivo que reporta temperatura,
 * humedad y luminosidad para una sala. {@code salaId} debe corresponder a la
 * sala asociada al sensor.</p>
 */
public record MensajeAmbientalDto(
        @JsonProperty("mensajeId") UUID mensajeId,
        @JsonProperty("sensorCodigo") String sensorCodigo,
        @JsonProperty("salaId") Long salaId,
        @JsonProperty("temperatura") Double temperatura,
        @JsonProperty("humedad") Double humedad,
        @JsonProperty("luminosidad") Double luminosidad,
        @JsonProperty("timestamp") OffsetDateTime timestamp
) {
}
