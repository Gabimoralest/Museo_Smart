package com.museosmart.iot.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Payload del topico ambiental {@code museo/sensores/ambiental}.
 *
 * <p>Un sensor ambiental es un unico dispositivo que reporta temperatura,
 * humedad y luminosidad para una sala. La identidad del sensor es su
 * {@code sensorCodigo}; la sala se toma del sensor en la base. {@code salaId}
 * es opcional: si viene debe coincidir con la sala real del sensor.</p>
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
