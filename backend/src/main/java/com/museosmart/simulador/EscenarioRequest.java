package com.museosmart.simulador;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * Solicitud para activar un escenario de demostracion.
 *
 * <p>{@code sala} admite el id real o el codigo 3D (SALA_1..SALA_6).
 * {@code sensorCodigo} solo se usa para SENSOR_DESCONECTADO.</p>
 */
@Schema(description = "Activacion de un escenario del simulador")
public record EscenarioRequest(

        @Schema(description = "Tipo de escenario",
                allowableValues = {"FALLA_CLIMA", "HUMEDAD_ALTA", "EXCESO_LUZ",
                        "GRUPO_VISITANTES", "SENSOR_DESCONECTADO"},
                example = "FALLA_CLIMA")
        @NotBlank(message = "El tipo de escenario es obligatorio")
        String tipo,

        @Schema(description = "Sala afectada: id real o codigo 3D (SALA_1..SALA_6)",
                example = "SALA_1")
        String sala,

        @Schema(description = "Codigo del sensor (solo para SENSOR_DESCONECTADO)",
                example = "SENSOR-AMBIENTAL-001")
        String sensorCodigo
) {
}
