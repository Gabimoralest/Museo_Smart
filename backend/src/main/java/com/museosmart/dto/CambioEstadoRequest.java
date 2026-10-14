package com.museosmart.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Cambio de estado de una exhibición")
public record CambioEstadoRequest(

        @Schema(description = "Nuevo estado: true activa, false inactiva", example = "false")
        @NotNull(message = "El estado es obligatorio")
        Boolean activa,

        @Schema(description = "Motivo del cambio (opcional)")
        String motivo
) {
}
