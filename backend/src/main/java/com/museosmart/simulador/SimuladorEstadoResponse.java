package com.museosmart.simulador;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Estado actual del simulador, segun el ultimo mensaje retenido en
 * {@code museo/simulador/estado}. El backend no inventa estado: lo reenvia tal
 * cual lo publica Node-RED.
 */
@Schema(description = "Estado del simulador publicado por Node-RED")
public record SimuladorEstadoResponse(
        List<EscenarioActivo> escenarios,
        boolean horarioForzado,
        String actualizadoEn
) {

    /** Escenario activo con su expiracion. */
    @Schema(description = "Escenario activo")
    public record EscenarioActivo(
            String tipo,
            String objetivo,
            Long desde,
            Long hasta,
            Long restantesSeg
    ) {
    }

    public static SimuladorEstadoResponse vacio() {
        return new SimuladorEstadoResponse(List.of(), false, null);
    }
}
