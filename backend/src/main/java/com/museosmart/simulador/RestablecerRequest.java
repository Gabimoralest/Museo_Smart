package com.museosmart.simulador;

import io.swagger.v3.oas.annotations.media.Schema;

/** Solicitud para restablecer escenarios de una sala o todos. */
@Schema(description = "Restablecimiento de escenarios del simulador")
public record RestablecerRequest(

        @Schema(description = "Sala a restablecer: id real o codigo 3D (SALA_1..SALA_6). "
                + "Se ignora si todo=true.", example = "SALA_1")
        String sala,

        @Schema(description = "Codigo del sensor a restablecer (escenario SENSOR_DESCONECTADO)",
                example = "SENSOR-AMBIENTAL-001")
        String sensorCodigo,

        @Schema(description = "Si es true, restablece todos los escenarios", example = "false")
        Boolean todo
) {
}
